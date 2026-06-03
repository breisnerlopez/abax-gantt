import postgres from "npm:postgres@3";

const MIGRATIONS_DIR = "./migrations";

export async function runMigrations() {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) {
    console.error("[migrate] DATABASE_URL no configurada, saltando migraciones");
    return;
  }

  const sql = postgres(url, { max: 1 });
  console.log("[migrate] Conectado a PostgreSQL");

  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  let files: string[] = [];
  try {
    for (const entry of Deno.readDirSync(MIGRATIONS_DIR)) {
      if (entry.isFile && entry.name.endsWith(".sql")) {
        files.push(entry.name);
      }
    }
  } catch {
    console.warn(`[migrate] Directorio ${MIGRATIONS_DIR} no encontrado, saltando`);
    await sql.end();
    return;
  }

  files.sort();

  for (const file of files) {
    const rows = await sql`SELECT 1 FROM _migrations WHERE name = ${file}`;
    if (rows.length > 0) {
      console.log(`[migrate] ${file} - ya ejecutada`);
      continue;
    }

    try {
      const content = Deno.readTextFileSync(`${MIGRATIONS_DIR}/${file}`);
      await sql.unsafe(content);
      await sql`INSERT INTO _migrations (name) VALUES (${file})`;
      console.log(`[migrate] ${file} - OK`);
    } catch (err) {
      console.error(`[migrate] ${file} - ERROR:`, err);
      await sql.end();
      throw err;
    }
  }

  await sql.end();
  console.log("[migrate] Migraciones completadas");
}
