import { authenticate, assertCanManageProject } from "../_shared/auth.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { requireUuid, readJson } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const url = new URL(req.url);

    if (req.method === "GET") {
      const projectId = url.searchParams.get("project_id");
      if (!projectId) throw new ApiError(400, "project_id es requerido");

      const { data, error } = await db
        .from("attachments")
        .select("*")
        .eq("project_id", requireUuid(projectId, "project_id"))
        .order("created_at", { ascending: false });
      if (error) throw new ApiError(500, error.message);

      const files = await Promise.all(
        (data ?? []).map(async (att) => {
          const { data: signed } = await db.storage
            .from("attachments")
            .createSignedUrl(att.file_path, 3600);
          return { ...att, download_url: signed?.signedUrl ?? null };
        }),
      );

      return okResponse({ data: files, count: files.length });
    }

    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") ?? "";
      if (!contentType.includes("multipart/form-data")) {
        throw new ApiError(400, "Content-Type debe ser multipart/form-data");
      }

      const form = await req.formData();
      const projectId = requireUuid(form.get("project_id"), "project_id");
      await assertCanManageProject(auth.userId, projectId);

      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(400, "Archivo requerido");

      if (file.size > 5 * 1024 * 1024) throw new ApiError(400, "Archivo excede 5 MB");
      if (file.size === 0) throw new ApiError(400, "Archivo vacio");

      const fileName = file.name || "archivo";
      if (!isAllowedAttachment(fileName, file.type)) throw new ApiError(400, "Tipo de archivo no permitido");
      const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
      const storagePath = `${projectId}/${crypto.randomUUID()}${ext}`;

      const { error: uploadError } = await db.storage
        .from("attachments")
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) throw new ApiError(400, uploadError.message);

      const { data, error } = await db
        .from("attachments")
        .insert({
          project_id: projectId,
          file_name: fileName,
          file_path: storagePath,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          uploaded_by: auth.userId,
        })
        .select()
        .single();
      if (error) {
        await db.storage.from("attachments").remove([storagePath]);
        throw new ApiError(400, error.message);
      }

      const { data: signed } = await db.storage
        .from("attachments")
        .createSignedUrl(storagePath, 3600);

      return okResponse({ data: { ...data, download_url: signed?.signedUrl ?? null } }, 201);
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/zip",
]);

const allowedExtensions = new Set([".pdf", ".xls", ".xlsx", ".doc", ".docx", ".txt", ".csv", ".zip", ".png", ".jpg", ".jpeg", ".webp"]);

function isAllowedAttachment(fileName: string, mimeType: string): boolean {
  if (mimeType.startsWith("image/")) return true;
  if (allowedMimeTypes.has(mimeType)) return true;
  const lowerName = fileName.toLowerCase();
  return [...allowedExtensions].some((extension) => lowerName.endsWith(extension));
}
