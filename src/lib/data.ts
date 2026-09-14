import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders, payments, properties, users } from "@/db/schema";
import type {
  CustomerDTO,
  DashboardData,
  OrderDTO,
  PaymentDTO,
  PropertyDTO,
  UserDTO,
} from "@/lib/types";
import {
  buildAlerts,
  groupByStatus,
  groupByType,
  salesByMonth,
  summarize,
} from "@/lib/analytics";

const iso = (d: Date | string | null | undefined): string => {
  if (!d) return "";
  if (typeof d === "string") return d;
  return d.toISOString();
};

const isoOrNull = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  return typeof d === "string" ? d : d.toISOString();
};

export async function listProperties(): Promise<PropertyDTO[]> {
  const rows = await db.select().from(properties).orderBy(asc(properties.code));
  return rows.map((r) => ({
    ...r,
    listedAt: r.listedAt ?? null,
    listingExpiresAt: r.listingExpiresAt ?? null,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }));
}

export async function listCustomers(): Promise<CustomerDTO[]> {
  const rows = await db.select().from(customers).orderBy(asc(customers.name));
  return rows.map((r) => ({
    ...r,
    consentAt: isoOrNull(r.consentAt),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }));
}

export async function listOrders(): Promise<OrderDTO[]> {
  const rows = await db
    .select({
      order: orders,
      customerName: customers.name,
      customerPhone: customers.phone,
      propertyCode: properties.code,
      propertyName: properties.name,
      agentName: users.name,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(properties, eq(properties.id, orders.propertyId))
    .leftJoin(users, eq(users.id, orders.agentId))
    .orderBy(desc(orders.orderDate), desc(orders.id));

  const allPayments = await db.select().from(payments).orderBy(asc(payments.paidAt));
  const byOrder = new Map<number, PaymentDTO[]>();
  for (const p of allPayments) {
    const list = byOrder.get(p.orderId) ?? [];
    list.push({
      id: p.id,
      orderId: p.orderId,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt,
      note: p.note,
    });
    byOrder.set(p.orderId, list);
  }

  return rows.map(({ order, ...rest }) => ({
    ...order,
    customerName: rest.customerName ?? undefined,
    customerPhone: rest.customerPhone ?? undefined,
    propertyCode: rest.propertyCode ?? undefined,
    propertyName: rest.propertyName ?? undefined,
    agentName: rest.agentName ?? null,
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    payments: byOrder.get(order.id) ?? [],
  }));
}

export async function listUsers(): Promise<UserDTO[]> {
  const rows = await db.select().from(users).orderBy(asc(users.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    isActive: r.isActive,
    lastLoginAt: isoOrNull(r.lastLoginAt),
    createdAt: iso(r.createdAt),
  }));
}

export async function buildDashboard(): Promise<DashboardData> {
  const [props, custs, ords] = await Promise.all([
    listProperties(),
    listCustomers(),
    listOrders(),
  ]);
  const { kpi, health } = summarize(props, ords, custs);
  const agentTotals = new Map<string, { total: number; count: number }>();
  for (const o of ords) {
    if (o.status === "dibatalkan") continue;
    const key = o.agentName ?? "Tanpa agen";
    const cur = agentTotals.get(key) ?? { total: 0, count: 0 };
    cur.total += o.paidAmount;
    cur.count += 1;
    agentTotals.set(key, cur);
  }

  return {
    kpi,
    salesByMonth: salesByMonth(ords),
    byType: groupByType(props),
    byStatus: groupByStatus(props),
    topAgents: [...agentTotals.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    alerts: buildAlerts(props, ords, custs),
    recentOrders: ords.slice(0, 6),
    staleProperties: health.stale.slice(0, 10),
  };
}
