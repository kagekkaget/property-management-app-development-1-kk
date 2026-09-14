import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders, payments, properties } from "@/db/schema";
import { can, writeAudit, type SessionUser } from "@/lib/auth";
import type {
  LeadSource,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PropertyStatus,
  PropertyType,
} from "@/lib/types";

export type OpKind =
  | "property.create"
  | "property.update"
  | "property.delete"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "order.create"
  | "order.update"
  | "order.delete"
  | "payment.create";

export type SyncOp = {
  kind: OpKind;
  id?: number | string | null;
  clientRef?: string | null;
  payload?: Record<string, unknown>;
};

export type OpResult = { ok: boolean; id?: number; clientRef?: string; error?: string };

const PROPERTY_TYPES: PropertyType[] = ["kavling", "rumah", "ruko", "apartemen", "tanah", "gudang"];
const PROPERTY_STATUS: PropertyStatus[] = ["tersedia", "booking", "terjual", "tertahan", "nonaktif"];
const ORDER_TYPES: OrderType[] = ["cash", "kpr", "bertahap", "sewa"];
const ORDER_STATUS: OrderStatus[] = ["menunggu", "diproses", "selesai", "dibatalkan"];
const PAYMENT_STATUS: PaymentStatus[] = ["belum_bayar", "dp", "cicilan", "lunas"];
const LEAD_SOURCES: LeadSource[] = [
  "walk_in",
  "whatsapp",
  "instagram",
  "facebook",
  "referensi",
  "agen",
  "website",
  "lainnya",
];

function str(v: unknown, max = 240): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? undefined : t.slice(0, max);
  }
  if (v === null || v === undefined) return undefined;
  return String(v).slice(0, max);
}

function int(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}

function big(v: unknown): number | undefined {
  const n = int(v);
  if (n === undefined) return undefined;
  return Math.max(0, Math.min(n, Number.MAX_SAFE_INTEGER));
}

function dateStr(v: unknown): string | null | undefined {
  if (typeof v !== "string") return undefined;
  if (v === "") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

function pick<T extends string>(v: unknown, allowed: T[]): T | undefined {
  return typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : undefined;
}

function isTempId(id: unknown): boolean {
  return typeof id === "string" && (id.startsWith("tmp-") || id.startsWith("off-"));
}

/* ------------------------------- resolving ------------------------------- */

async function resolveId(
  table: typeof properties | typeof customers | typeof orders,
  ref: string,
): Promise<number | null> {
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.clientRef as never, ref))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function resolveProperty(op: SyncOp): Promise<number | null> {
  if (typeof op.id === "number") return op.id;
  const ref = op.clientRef ?? (typeof op.id === "string" ? op.id : null);
  if (ref) return resolveId(properties, ref);
  return null;
}

async function resolveCustomer(op: SyncOp): Promise<number | null> {
  if (typeof op.id === "number") return op.id;
  const ref = op.clientRef ?? (typeof op.id === "string" ? op.id : null);
  if (ref) return resolveId(customers, ref);
  return null;
}

async function resolveOrder(op: SyncOp): Promise<number | null> {
  if (typeof op.id === "number") return op.id;
  const ref = op.clientRef ?? (typeof op.id === "string" ? op.id : null);
  if (ref) return resolveId(orders, ref);
  return null;
}

function refOf(op: SyncOp): string | undefined {
  if (op.clientRef) return op.clientRef;
  if (typeof op.id === "string" && isTempId(op.id)) return op.id;
  return undefined;
}

/* ------------------------------- generators ------------------------------ */

async function nextCode(prefix: string, table: "properties" | "orders"): Promise<string> {
  const year = new Date().getFullYear();
  const rows =
    table === "properties"
      ? await db.select({ count: sql<number>`count(*)::int` }).from(properties)
      : await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  const seq = (rows[0]?.count ?? 0) + 1;
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

function paymentStatusFor(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return "belum_bayar";
  if (paid >= total) return "lunas";
  if (paid <= total * 0.25) return "dp";
  return "cicilan";
}

function patchFrom(
  p: Record<string, unknown>,
  map: [string, (v: unknown) => unknown][],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [field, fn] of map) {
    if (p[field] !== undefined) {
      const val = fn(p[field]);
      if (val !== undefined) patch[field] = val;
    }
  }
  return patch;
}

/* --------------------------------- apply --------------------------------- */

export async function applyOp(user: SessionUser, op: SyncOp): Promise<OpResult> {
  const p = op.payload ?? {};

  if (op.kind === "property.create") {
    if (!can(user.role, "inventory.edit")) return { ok: false, error: "Akses ditolak" };
    const name = str(p.name, 180);
    if (!name) return { ok: false, error: "Nama unit wajib diisi" };
    const code = str(p.code, 40) ?? (await nextCode("UNT", "properties"));
    const [row] = await db
      .insert(properties)
      .values({
        clientRef: refOf(op) ?? null,
        code,
        name,
        type: pick(p.type, PROPERTY_TYPES) ?? "kavling",
        status: pick(p.status, PROPERTY_STATUS) ?? "tersedia",
        project: str(p.project, 160) ?? null,
        cluster: str(p.cluster, 120) ?? null,
        address: str(p.address, 500) ?? null,
        district: str(p.district, 120) ?? null,
        city: str(p.city, 120) ?? "Palembang",
        certificate: str(p.certificate, 40) ?? null,
        landArea: big(p.landArea) ?? 0,
        buildingArea: big(p.buildingArea) ?? 0,
        quantity: big(p.quantity) ?? 1,
        minStock: big(p.minStock) ?? 1,
        price: big(p.price) ?? 0,
        cost: big(p.cost) ?? 0,
        monthlyFee: big(p.monthlyFee) ?? 0,
        listedAt: dateStr(p.listedAt) ?? null,
        listingExpiresAt: dateStr(p.listingExpiresAt) ?? null,
        agentId: user.id,
        notes: str(p.notes, 1000) ?? null,
      })
      .returning({ id: properties.id, code: properties.code });
    await writeAudit({
      user,
      action: "create",
      entity: "property",
      entityId: row!.id,
      detail: `Unit ${row!.code} ditambahkan`,
    });
    return { ok: true, id: row!.id, clientRef: refOf(op) };
  }

  if (op.kind === "property.update") {
    if (!can(user.role, "inventory.edit")) return { ok: false, error: "Akses ditolak" };
    const id = await resolveProperty(op);
    if (!id) return { ok: false, error: "Unit tidak ditemukan" };
    const patch = patchFrom(p, [
      ["name", (v) => str(v, 180)],
      ["type", (v) => pick(v, PROPERTY_TYPES)],
      ["status", (v) => pick(v, PROPERTY_STATUS)],
      ["project", (v) => str(v, 160)],
      ["cluster", (v) => str(v, 120)],
      ["address", (v) => str(v, 500)],
      ["district", (v) => str(v, 120)],
      ["city", (v) => str(v, 120)],
      ["certificate", (v) => str(v, 40)],
      ["landArea", big],
      ["buildingArea", big],
      ["quantity", big],
      ["minStock", big],
      ["price", big],
      ["cost", big],
      ["monthlyFee", big],
      ["listedAt", dateStr],
      ["listingExpiresAt", dateStr],
      ["notes", (v) => str(v, 1000)],
    ]);
    await db
      .update(properties)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(properties.id, id));
    await writeAudit({ user, action: "update", entity: "property", entityId: id, detail: "Data unit diperbarui" });
    return { ok: true, id };
  }

  if (op.kind === "property.delete") {
    if (!can(user.role, "inventory.delete")) return { ok: false, error: "Akses ditolak" };
    const id = await resolveProperty(op);
    if (!id) return { ok: false, error: "Unit tidak ditemukan" };
    await db.delete(properties).where(eq(properties.id, id));
    await writeAudit({ user, action: "delete", entity: "property", entityId: id, detail: "Unit dihapus" });
    return { ok: true, id };
  }

  if (op.kind === "customer.create") {
    if (!can(user.role, "customer.edit")) return { ok: false, error: "Akses ditolak" };
    const name = str(p.name, 150);
    const phone = str(p.phone, 40);
    if (!name || !phone) return { ok: false, error: "Nama dan nomor telepon wajib diisi" };
    const consent = p.consentPdp === true;
    const [row] = await db
      .insert(customers)
      .values({
        clientRef: refOf(op) ?? null,
        name,
        phone,
        email: str(p.email, 180) ?? null,
        address: str(p.address, 500) ?? null,
        nik: str(p.nik, 32) ?? null,
        source: pick(p.source, LEAD_SOURCES) ?? "walk_in",
        preferredType: pick(p.preferredType, PROPERTY_TYPES) ?? null,
        preferredLocation: str(p.preferredLocation, 160) ?? null,
        budgetMin: big(p.budgetMin) ?? 0,
        budgetMax: big(p.budgetMax) ?? 0,
        preferenceNotes: str(p.preferenceNotes, 1000) ?? null,
        consentPdp: consent,
        consentAt: consent ? new Date() : null,
        agentId: user.id,
        notes: str(p.notes, 1000) ?? null,
      })
      .returning({ id: customers.id });
    await writeAudit({
      user,
      action: "create",
      entity: "customer",
      entityId: row!.id,
      detail: `Pelanggan ${name} ditambahkan (persetujuan PDP: ${consent ? "ya" : "tidak"})`,
    });
    return { ok: true, id: row!.id, clientRef: refOf(op) };
  }

  if (op.kind === "customer.update") {
    if (!can(user.role, "customer.edit")) return { ok: false, error: "Akses ditolak" };
    const id = await resolveCustomer(op);
    if (!id) return { ok: false, error: "Pelanggan tidak ditemukan" };
    const patch = patchFrom(p, [
      ["name", (v) => str(v, 150)],
      ["phone", (v) => str(v, 40)],
      ["email", (v) => str(v, 180)],
      ["address", (v) => str(v, 500)],
      ["nik", (v) => str(v, 32)],
      ["source", (v) => pick(v, LEAD_SOURCES)],
      ["preferredType", (v) => pick(v, PROPERTY_TYPES)],
      ["preferredLocation", (v) => str(v, 160)],
      ["budgetMin", big],
      ["budgetMax", big],
      ["preferenceNotes", (v) => str(v, 1000)],
      ["notes", (v) => str(v, 1000)],
    ]);
    if (p.consentPdp !== undefined) {
      const consent = p.consentPdp === true;
      patch.consentPdp = consent;
      patch.consentAt = consent ? new Date() : null;
    }
    await db
      .update(customers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(customers.id, id));
    await writeAudit({ user, action: "update", entity: "customer", entityId: id, detail: "Data pelanggan diperbarui" });
    return { ok: true, id };
  }

  if (op.kind === "customer.delete") {
    if (!can(user.role, "customer.delete")) return { ok: false, error: "Akses ditolak" };
    const id = await resolveCustomer(op);
    if (!id) return { ok: false, error: "Pelanggan tidak ditemukan" };
    await db.delete(customers).where(eq(customers.id, id));
    await writeAudit({
      user,
      action: "delete",
      entity: "customer",
      entityId: id,
      detail: "Pelanggan dihapus (hak penghapusan data — UU PDP No. 27/2022)",
    });
    return { ok: true, id };
  }

  if (op.kind === "order.create") {
    if (!can(user.role, "order.edit")) return { ok: false, error: "Akses ditolak" };
    let customerId: number | null = null;
    if (typeof p.customerId === "number") {
      customerId = p.customerId;
    } else if (typeof p.customerId === "string") {
      const parsed = Number(p.customerId);
      customerId = Number.isFinite(parsed) ? parsed : null;
    }
    if (customerId === null && typeof p.customerRef === "string") {
      customerId = await resolveCustomer(op);
    }
    let propertyId: number | null = null;
    if (typeof p.propertyId === "number") {
      propertyId = p.propertyId;
    } else if (typeof p.propertyId === "string") {
      const parsed = Number(p.propertyId);
      propertyId = Number.isFinite(parsed) ? parsed : null;
    }
    if (propertyId === null && typeof p.propertyRef === "string") {
      propertyId = await resolveProperty(op);
    }
    if (!customerId) return { ok: false, error: "Pelanggan belum dipilih" };
    if (!propertyId) return { ok: false, error: "Unit properti belum dipilih" };

    const [prop] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!prop) return { ok: false, error: "Unit properti tidak ditemukan" };

    const qty = Math.max(1, big(p.quantity) ?? 1);
    const total = big(p.totalPrice) ?? Number(prop.price) * qty;
    const paid = big(p.paidAmount) ?? 0;
    const [row] = await db
      .insert(orders)
      .values({
        clientRef: refOf(op) ?? null,
        code: str(p.code, 40) ?? (await nextCode("TRX", "orders")),
        customerId,
        propertyId,
        agentId: big(p.agentId) ?? user.id,
        orderType: pick(p.orderType, ORDER_TYPES) ?? "cash",
        status: pick(p.status, ORDER_STATUS) ?? "menunggu",
        paymentStatus: paymentStatusFor(total, paid),
        quantity: qty,
        totalPrice: total,
        paidAmount: paid,
        orderDate: dateStr(p.orderDate) ?? new Date().toISOString().slice(0, 10),
        nextPaymentDue: dateStr(p.nextPaymentDue) ?? null,
        notes: str(p.notes, 1000) ?? null,
      })
      .returning({ id: orders.id, code: orders.code });

    if (paid > 0) {
      await db.insert(payments).values({
        orderId: row!.id,
        amount: paid,
        method: str(p.paymentMethod, 40) ?? "transfer",
        paidAt: dateStr(p.orderDate) ?? new Date().toISOString().slice(0, 10),
        note: "Pembayaran awal saat transaksi dibuat",
      });
    }
    if (prop.status === "tersedia") {
      await db
        .update(properties)
        .set({ status: "booking", quantity: Math.max(0, prop.quantity - 1), updatedAt: new Date() })
        .where(eq(properties.id, propertyId));
    }
    await writeAudit({
      user,
      action: "create",
      entity: "order",
      entityId: row!.id,
      detail: `Transaksi ${row!.code} dibuat`,
    });
    return { ok: true, id: row!.id, clientRef: refOf(op) };
  }

  if (op.kind === "order.update") {
    if (!can(user.role, "order.edit")) return { ok: false, error: "Akses ditolak" };
    const id = await resolveOrder(op);
    if (!id) return { ok: false, error: "Transaksi tidak ditemukan" };
    const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!current) return { ok: false, error: "Transaksi tidak ditemukan" };
    const patch = patchFrom(p, [
      ["orderType", (v) => pick(v, ORDER_TYPES)],
      ["status", (v) => pick(v, ORDER_STATUS)],
      ["quantity", big],
      ["totalPrice", big],
      ["nextPaymentDue", dateStr],
      ["notes", (v) => str(v, 1000)],
    ]);
    if (p.paidAmount !== undefined) patch.paidAmount = big(p.paidAmount) ?? 0;
    const total = (patch.totalPrice as number | undefined) ?? Number(current.totalPrice);
    const paid = (patch.paidAmount as number | undefined) ?? Number(current.paidAmount);
    patch.paymentStatus =
      pick(p.paymentStatus, PAYMENT_STATUS) ?? paymentStatusFor(total, paid);
    await db
      .update(orders)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(orders.id, id));

    if (patch.status === "selesai") {
      await db
        .update(properties)
        .set({ status: "terjual", updatedAt: new Date() })
        .where(eq(properties.id, current.propertyId));
    } else if (patch.status === "dibatalkan") {
      await db
        .update(properties)
        .set({ status: "tersedia", updatedAt: new Date() })
        .where(and(eq(properties.id, current.propertyId), eq(properties.status, "booking")));
    }
    await writeAudit({ user, action: "update", entity: "order", entityId: id, detail: "Transaksi diperbarui" });
    return { ok: true, id };
  }

  if (op.kind === "order.delete") {
    if (!can(user.role, "order.delete")) return { ok: false, error: "Akses ditolak" };
    const id = await resolveOrder(op);
    if (!id) return { ok: false, error: "Transaksi tidak ditemukan" };
    const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    await db.delete(orders).where(eq(orders.id, id));
    if (current) {
      await db
        .update(properties)
        .set({ status: "tersedia", updatedAt: new Date() })
        .where(and(eq(properties.id, current.propertyId), eq(properties.status, "booking")));
    }
    await writeAudit({ user, action: "delete", entity: "order", entityId: id, detail: "Transaksi dihapus" });
    return { ok: true, id };
  }

  if (op.kind === "payment.create") {
    if (!can(user.role, "order.edit")) return { ok: false, error: "Akses ditolak" };
    const orderId =
      typeof p.orderId === "number"
        ? p.orderId
        : typeof p.orderRef === "string"
          ? await resolveId(orders, p.orderRef)
          : null;
    if (!orderId) return { ok: false, error: "Transaksi tidak ditemukan" };
    const amount = big(p.amount);
    if (!amount || amount <= 0) return { ok: false, error: "Nominal pembayaran tidak valid" };
    const [current] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!current) return { ok: false, error: "Transaksi tidak ditemukan" };
    await db.insert(payments).values({
      orderId,
      amount,
      method: str(p.method, 40) ?? "transfer",
      paidAt: dateStr(p.paidAt) ?? new Date().toISOString().slice(0, 10),
      note: str(p.note, 500) ?? null,
    });
    const newPaid = Number(current.paidAmount) + amount;
    await db
      .update(orders)
      .set({
        paidAmount: newPaid,
        paymentStatus: paymentStatusFor(Number(current.totalPrice), newPaid),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await writeAudit({
      user,
      action: "payment",
      entity: "order",
      entityId: orderId,
      detail: `Pembayaran Rp ${amount.toLocaleString("id-ID")} dicatat`,
    });
    return { ok: true, id: orderId };
  }

  return { ok: false, error: `Operasi tidak dikenal: ${op.kind}` };
}
