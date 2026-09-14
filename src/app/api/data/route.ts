import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { can, getSessionUser } from "@/lib/auth";
import { buildDashboard, listCustomers, listOrders, listProperties, listUsers } from "@/lib/data";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Tidak terautentikasi" }, { status: 401 });

  try {
    await ensureSeeded();
    const [properties, customers, orders, dashboard] = await Promise.all([
      listProperties(),
      listCustomers(),
      listOrders(),
      buildDashboard(),
    ]);

    const staff = can(user.role, "user.manage") ? await listUsers() : [];
    const audit = can(user.role, "audit.view")
      ? (
          await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(60)
        ).map((row) => ({
          id: row.id,
          userName: row.userName,
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          detail: row.detail,
          createdAt: row.createdAt.toISOString(),
        }))
      : [];

    return Response.json({
      user,
      properties,
      customers,
      orders,
      users: staff,
      audit,
      dashboard,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json({ error: "Gagal memuat data" }, { status: 500 });
  }
}
