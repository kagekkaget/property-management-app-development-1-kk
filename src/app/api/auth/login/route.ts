import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword, writeAudit } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return Response.json({ error: "Email dan kata sandi wajib diisi" }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "Email atau kata sandi salah" }, { status: 401 });
    }
    if (!user.isActive) {
      return Response.json({ error: "Akun dinonaktifkan. Hubungi pemilik." }, { status: 403 });
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await createSession(user.id, request.headers.get("user-agent"));
    await writeAudit({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
      action: "login",
      entity: "auth",
      entityId: user.id,
      detail: "Login berhasil",
    });

    return Response.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan pada server";
    return Response.json({ error: `Terjadi kesalahan pada server: ${message}` }, { status: 500 });
  }
}
