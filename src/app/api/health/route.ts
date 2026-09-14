import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Health check error:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
