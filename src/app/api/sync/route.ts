import { getSessionUser } from "@/lib/auth";
import { applyOp, type SyncOp } from "@/lib/mutations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Tidak terautentikasi" }, { status: 401 });

  let body: { ops?: SyncOp[] };
  try {
    body = (await request.json()) as { ops?: SyncOp[] };
  } catch {
    return Response.json({ error: "Format permintaan tidak valid" }, { status: 400 });
  }

  const ops = Array.isArray(body.ops) ? body.ops.slice(0, 100) : [];
  if (ops.length === 0) return Response.json({ results: [] });

  const results = [];
  for (const op of ops) {
    try {
      results.push(await applyOp(user, op));
    } catch (error) {
      results.push({ ok: false, error: error instanceof Error ? error.message : "Gagal memproses" });
    }
  }

  const anyFailed = results.some((r) => !r.ok);
  return Response.json({ results }, { status: anyFailed ? 207 : 200 });
}
