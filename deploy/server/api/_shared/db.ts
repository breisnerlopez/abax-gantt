import postgres from "npm:postgres@3";

let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!sql) {
    const url = Deno.env.get("DATABASE_URL");
    if (!url) throw new Error("DATABASE_URL no configurada");
    sql = postgres(url, {
      max: 10,
      idle_timeout: 30,
      types: {
        numeric: {
          to: 1700,
          from: [1700],
          serialize: (n: number | string) => String(n),
          parse: (s: string) => Number(s),
        },
      },
    });
  }
  return sql;
}

export interface DbClient {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

export function getClient(): DbClient {
  const s = getDb();
  return {
    async query<T>(queryString: string, params: unknown[] = []): Promise<{ rows: T[] }> {
      const rows = await s.unsafe(queryString, params as never[]) as T[];
      return { rows };
    },
    async queryOne<T>(queryString: string, params: unknown[] = []): Promise<T | null> {
      const rows = await s.unsafe(queryString, params as never[]) as T[];
      return rows.length > 0 ? rows[0] : null;
    },
  };
}
