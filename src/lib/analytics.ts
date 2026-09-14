import { daysBetween } from "./format";
import type { AlertItem, CustomerDTO, OrderDTO, PropertyDTO } from "./types";

/** Ambang batas konfigurasi (hari) */
export const EXPIRY_WARNING_DAYS = 45;
export const STALE_UNIT_DAYS = 120;

export type InventoryHealth = {
  lowStock: PropertyDTO[];
  expiringSoon: PropertyDTO[];
  expired: PropertyDTO[];
  stale: PropertyDTO[];
};

export function inventoryHealth(properties: PropertyDTO[]): InventoryHealth {
  const now = new Date();
  const lowStock = properties.filter((p) => p.status !== "terjual" && p.quantity <= p.minStock);
  const expiringSoon: PropertyDTO[] = [];
  const expired: PropertyDTO[] = [];
  const stale: PropertyDTO[] = [];

  for (const p of properties) {
    if (p.listingExpiresAt) {
      const diff = daysBetween(now, p.listingExpiresAt);
      if (diff < 0) expired.push(p);
      else if (diff <= EXPIRY_WARNING_DAYS) expiringSoon.push(p);
    }
    if (p.status === "tersedia" && p.listedAt) {
      if (daysBetween(p.listedAt, now) >= STALE_UNIT_DAYS) stale.push(p);
    } else if (p.status === "tersedia" && !p.listedAt) {
      stale.push(p);
    }
  }

  return { lowStock, expiringSoon, expired, stale };
}

export function overdueOrders(orders: OrderDTO[]): OrderDTO[] {
  const today = new Date().toISOString().slice(0, 10);
  return orders.filter(
    (o) =>
      o.status !== "dibatalkan" &&
      o.paymentStatus !== "lunas" &&
      !!o.nextPaymentDue &&
      o.nextPaymentDue < today,
  );
}

export function buildAlerts(
  properties: PropertyDTO[],
  orders: OrderDTO[],
  customers: CustomerDTO[],
): AlertItem[] {
  const health = inventoryHealth(properties);
  const overdue = overdueOrders(orders);
  const alerts: AlertItem[] = [];

  for (const p of health.expired) {
    alerts.push({
      id: `exp-${p.id}`,
      level: "kritis",
      category: "kadaluarsa",
      title: `Listing ${p.code} sudah kadaluarsa`,
      description: `${p.name} — masa pemasaran berakhir ${p.listingExpiresAt}. Perpanjang listing atau nonaktifkan unit.`,
      link: "/inventaris",
    });
  }
  for (const p of health.expiringSoon) {
    const diff = daysBetween(new Date(), p.listingExpiresAt as string);
    alerts.push({
      id: `soon-${p.id}`,
      level: "peringatan",
      category: "kadaluarsa",
      title: `Listing ${p.code} berakhir ${diff} hari lagi`,
      description: `${p.name} — segera jalankan promosi atau turunkan harga.`,
      link: "/inventaris",
    });
  }
  for (const p of health.lowStock) {
    alerts.push({
      id: `low-${p.id}`,
      level: p.quantity === 0 ? "kritis" : "peringatan",
      category: "stok",
      title: `Stok ${p.code} ${p.quantity} unit`,
      description: `${p.name} — di bawah batas minimum ${p.minStock} unit.`,
      link: "/inventaris",
    });
  }
  for (const p of health.stale.slice(0, 8)) {
    alerts.push({
      id: `stale-${p.id}`,
      level: "peringatan",
      category: "unit_menganggur",
      title: `Unit ${p.code} menganggur ${p.listedAt ? daysBetween(p.listedAt, new Date()) : STALE_UNIT_DAYS}+ hari`,
      description: `${p.name} — potensi pemborosan modal & biaya perawatan.`,
      link: "/laporan",
    });
  }
  for (const o of overdue.slice(0, 10)) {
    alerts.push({
      id: `due-${o.id}`,
      level: "kritis",
      category: "pembayaran",
      title: `Tagihan jatuh tempo: ${o.code}`,
      description: `${o.customerName ?? "Pelanggan"} — sisa ${Math.max(
        o.totalPrice - o.paidAmount,
        0,
      ).toLocaleString("id-ID")} jatuh tempo ${o.nextPaymentDue}.`,
      link: "/pesanan",
    });
  }
  const noConsent = customers.filter((c) => !c.consentPdp).length;
  if (noConsent > 0) {
    alerts.push({
      id: "pdp-consent",
      level: "info",
      category: "kadaluarsa",
      title: `${noConsent} pelanggan belum memberi persetujuan PDP`,
      description: "Lengkapi persetujuan pemrosesan data pribadi sesuai UU No. 27/2022.",
      link: "/pelanggan",
    });
  }

  const rank = { kritis: 0, peringatan: 1, info: 2 } as const;
  return alerts.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 40);
}

export function summarize(
  properties: PropertyDTO[],
  orders: OrderDTO[],
  customers: CustomerDTO[],
) {
  const health = inventoryHealth(properties);
  const valid = orders.filter((o) => o.status !== "dibatalkan");
  const monthKey = new Date().toISOString().slice(0, 7);

  const sold = properties.filter((p) => p.status === "terjual");
  const revenueTotal = valid.reduce(
    (sum, o) => sum + (o.status === "selesai" ? o.totalPrice : o.paidAmount),
    0,
  );
  const revenueThisMonth = valid
    .filter((o) => o.orderDate.slice(0, 7) === monthKey)
    .reduce((sum, o) => sum + (o.status === "selesai" ? o.totalPrice : o.paidAmount), 0);
  const receivable = valid.reduce(
    (sum, o) => sum + Math.max(o.totalPrice - o.paidAmount, 0),
    0,
  );

  const kpi = {
    totalProperty: properties.length,
    availableUnits: properties
      .filter((p) => p.status === "tersedia")
      .reduce((sum, p) => sum + p.quantity, 0),
    soldUnits: sold.reduce((sum, p) => sum + p.quantity, 0),
    bookedUnits: properties
      .filter((p) => p.status === "booking")
      .reduce((sum, p) => sum + p.quantity, 0),
    stockValue: properties
      .filter((p) => p.status === "tersedia")
      .reduce((sum, p) => sum + p.price * p.quantity, 0),
    potentialRevenue: properties
      .filter((p) => p.status !== "terjual")
      .reduce((sum, p) => sum + p.price * p.quantity, 0),
    revenueThisMonth,
    revenueTotal,
    receivable,
    wasteValue: health.stale.reduce((sum, p) => sum + p.cost * p.quantity, 0),
    staleUnits: health.stale.length,
    customers: customers.length,
    activeOrders: valid.filter((o) => o.status !== "selesai").length,
  };

  return { kpi, health };
}

export function salesByMonth(orders: OrderDTO[], months = 6) {
  const buckets: { month: string; total: number; count: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rows = orders.filter((o) => o.status !== "dibatalkan" && o.orderDate.slice(0, 7) === key);
    buckets.push({
      month: new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(d),
      total: rows.reduce((sum, o) => sum + o.paidAmount, 0),
      count: rows.length,
    });
  }
  return buckets;
}

export function groupByType(properties: PropertyDTO[]) {
  const types = new Map<string, { total: number; value: number; available: number }>();
  for (const p of properties) {
    const cur = types.get(p.type) ?? { total: 0, value: 0, available: 0 };
    cur.total += p.quantity;
    cur.value += p.price * p.quantity;
    if (p.status === "tersedia") cur.available += p.quantity;
    types.set(p.type, cur);
  }
  return [...types.entries()].map(([type, v]) => ({ type: type as PropertyDTO["type"], ...v }));
}

export function groupByStatus(properties: PropertyDTO[]) {
  const map = new Map<string, number>();
  for (const p of properties) map.set(p.status, (map.get(p.status) ?? 0) + p.quantity);
  return [...map.entries()].map(([status, count]) => ({
    status: status as PropertyDTO["status"],
    count,
  }));
}
