import type {
  LeadSource,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PropertyStatus,
  PropertyType,
} from "./types";

export const rupiah = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
};

export const rupiahShort = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
  return rupiah(n);
};

export const numberID = (value: number | null | undefined): string =>
  new Intl.NumberFormat("id-ID").format(Number(value ?? 0));

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const daysBetween = (from: Date | string, to: Date | string): number => {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  kavling: "Kavling",
  rumah: "Rumah",
  ruko: "Ruko",
  apartemen: "Apartemen",
  tanah: "Tanah",
  gudang: "Gudang",
};

export const PROPERTY_STATUS_LABEL: Record<PropertyStatus, string> = {
  tersedia: "Tersedia",
  booking: "Booking",
  terjual: "Terjual",
  tertahan: "Tertahan",
  nonaktif: "Nonaktif",
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  cash: "Cash",
  kpr: "KPR",
  bertahap: "Bertahap",
  sewa: "Sewa",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  menunggu: "Menunggu",
  diproses: "Diproses",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  belum_bayar: "Belum Bayar",
  dp: "DP",
  cicilan: "Cicilan",
  lunas: "Lunas",
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  walk_in: "Kunjungan Langsung",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  referensi: "Referensi",
  agen: "Agen",
  website: "Website",
  lainnya: "Lainnya",
};

export const STATUS_TONE: Record<string, string> = {
  tersedia: "bg-emerald-100 text-emerald-800 border-emerald-200",
  booking: "bg-amber-100 text-amber-800 border-amber-200",
  terjual: "bg-sky-100 text-sky-800 border-sky-200",
  tertahan: "bg-orange-100 text-orange-800 border-orange-200",
  nonaktif: "bg-slate-200 text-slate-700 border-slate-300",
  menunggu: "bg-slate-100 text-slate-700 border-slate-300",
  diproses: "bg-amber-100 text-amber-800 border-amber-200",
  selesai: "bg-emerald-100 text-emerald-800 border-emerald-200",
  dibatalkan: "bg-rose-100 text-rose-800 border-rose-200",
  belum_bayar: "bg-rose-100 text-rose-800 border-rose-200",
  dp: "bg-amber-100 text-amber-800 border-amber-200",
  cicilan: "bg-sky-100 text-sky-800 border-sky-200",
  lunas: "bg-emerald-100 text-emerald-800 border-emerald-200",
};
