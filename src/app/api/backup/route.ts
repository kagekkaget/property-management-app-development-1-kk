import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { can, getSessionUser, writeAudit } from "@/lib/auth";
import { listCustomers, listOrders, listProperties, listUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Cadangan data (JSON) — dapat dijalankan otomatis oleh scheduler (cron) harian
 * maupun manual oleh pemilik. Tidak memuat kredensial apa pun.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Tidak terautentikasi" }, { status: 401 });
  if (!can(user.role, "user.manage")) return Response.json({ error: "Akses ditolak" }, { status: 403 });

  const [properties, customers, orders, users, audit] = await Promise.all([
    listProperties(),
    listCustomers(),
    listOrders(),
    listUsers(),
    db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(2000),
  ]);

  const snapshot = {
    meta: {
      app: "Kavlingo Palembang",
      version: 1,
      generatedAt: new Date().toISOString(),
      generatedBy: user.email,
      retentionDays: 30,
      regulation: "UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi",
    },
    properties,
    customers,
    orders,
    users,
    auditLogs: audit.map((a) => ({
      id: a.id,
      userName: a.userName,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  await writeAudit({ user, action: "backup", entity: "sistem", detail: "Cadangan data (JSON) dibuat" });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new Response(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kavlingo-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
