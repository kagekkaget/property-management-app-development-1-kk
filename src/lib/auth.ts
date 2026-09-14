import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "kavlingo_session";
const SESSION_DAYS = 7;

export type Role = "owner" | "manager" | "staff";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
};

/* ------------------------------- Password -------------------------------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

/* -------------------------------- Session -------------------------------- */

export async function createSession(userId: number, userAgent?: string | null) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    token,
    userId,
    userAgent: userAgent?.slice(0, 240) ?? null,
    expiresAt,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        isActive: users.isActive,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row || !row.isActive) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as Role,
      phone: row.phone,
    };
  } catch {
    return null;
  }
}

/* ------------------------------ Permissions ------------------------------ */

export { can, ROLE_LABEL } from "@/lib/rbac";
export type { Action } from "@/lib/rbac";

/* ------------------------------- Audit log ------------------------------- */

export async function writeAudit(input: {
  user: SessionUser | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  detail?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: input.user?.id ?? null,
      userName: input.user?.name ?? "sistem",
      action: input.action,
      entity: input.entity,
      entityId: input.entityId != null ? String(input.entityId) : null,
      detail: input.detail?.slice(0, 900) ?? null,
    });
  } catch {
    // audit log tidak boleh memblokir operasi utama
  }
}
