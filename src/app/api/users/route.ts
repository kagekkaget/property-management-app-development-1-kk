import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { can, getSessionUser, hashPassword, writeAudit } from "@/lib/auth";
import { listUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Tidak terautentikasi" }, { status: 401 });
  if (!can(user.role, "user.manage")) return Response.json({ error: "Akses ditolak" }, { status: 403 });
  return Response.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  const actor = await getSessionUser();
  if (!actor) return Response.json({ error: "Tidak terautentikasi" }, { status: 401 });
  if (!can(actor.role, "user.manage")) return Response.json({ error: "Akses ditolak" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 180);
  const password = String(body.password ?? "");
  const role = ["owner", "manager", "staff"].includes(String(body.role)) ? String(body.role) : "staff";
  const phone = body.phone ? String(body.phone).slice(0, 40) : null;

  if (!name || !email || password.length < 6) {
    return Response.json(
      { error: "Nama, email valid, dan kata sandi minimal 6 karakter wajib diisi" },
      { status: 400 },
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Format email tidak valid" }, { status: 400 });
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return Response.json({ error: "Email sudah digunakan" }, { status: 409 });

  const [row] = await db
    .insert(users)
    .values({ name, email, phone, role: role as "owner" | "manager" | "staff", passwordHash: hashPassword(password) })
    .returning({ id: users.id });

  await writeAudit({ user: actor, action: "create", entity: "user", entityId: row!.id, detail: `Pengguna ${email} (${role}) dibuat` });
  return Response.json({ ok: true, id: row!.id, users: await listUsers() });
}

export async function PATCH(request: Request) {
  const actor = await getSessionUser();
  if (!actor) return Response.json({ error: "Tidak terautentikasi" }, { status: 401 });
  if (!can(actor.role, "user.manage")) return Response.json({ error: "Akses ditolak" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isFinite(id)) return Response.json({ error: "ID tidak valid" }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body.phone === "string") patch.phone = body.phone.slice(0, 40);
  if (typeof body.role === "string" && ["owner", "manager", "staff"].includes(body.role)) patch.role = body.role;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  if (typeof body.password === "string" && body.password.length >= 6) {
    patch.passwordHash = hashPassword(body.password);
  }

  if (id === actor.id && patch.isActive === false) {
    return Response.json({ error: "Tidak dapat menonaktifkan akun sendiri" }, { status: 400 });
  }

  await db.update(users).set(patch).where(eq(users.id, id));
  await writeAudit({ user: actor, action: "update", entity: "user", entityId: id, detail: "Data pengguna diperbarui" });
  return Response.json({ ok: true, users: await listUsers() });
}

export async function DELETE(request: Request) {
  const actor = await getSessionUser();
  if (!actor) return Response.json({ error: "Tidak terautentikasi" }, { status: 401 });
  if (!can(actor.role, "user.manage")) return Response.json({ error: "Akses ditolak" }, { status: 403 });

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return Response.json({ error: "ID tidak valid" }, { status: 400 });
  if (id === actor.id) return Response.json({ error: "Tidak dapat menghapus akun sendiri" }, { status: 400 });

  await db.delete(users).where(eq(users.id, id));
  await writeAudit({ user: actor, action: "delete", entity: "user", entityId: id, detail: "Pengguna dihapus" });
  return Response.json({ ok: true, users: await listUsers() });
}
