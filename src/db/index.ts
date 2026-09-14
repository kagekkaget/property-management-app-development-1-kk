import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const url = new URL(databaseUrl);
const sslParam = url.searchParams.get("sslmode");
const sslConfig = sslParam === "require" || process.env.NODE_ENV === "production"
  ? { rejectUnauthorized: false }
  : false;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    ssl: sslConfig,
  });

export async function verifyConnection(): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT 1");
    return result.rowCount === 1;
  } finally {
    client.release();
  }
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
