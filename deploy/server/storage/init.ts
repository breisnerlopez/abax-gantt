export async function ensureStorageDir(basePath: string) {
  try {
    Deno.mkdirSync(basePath, { recursive: true });
    console.log(`[storage] Directorio creado: ${basePath}`);
  } catch (err) {
    if (!(err instanceof Deno.errors.AlreadyExists)) {
      console.warn(`[storage] No se pudo crear directorio: ${err}`);
    }
  }
}
