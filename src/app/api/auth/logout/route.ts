import { destroySession, getSessionUser, writeAudit } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (user) {
    await writeAudit({ user, action: "logout", entity: "auth", entityId: user.id, detail: "Keluar dari sistem" });
  }
  await destroySession();
  return Response.json({ ok: true });
}
