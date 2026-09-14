"use client";

import Link from "next/link";
import { useApp } from "@/components/SyncProvider";
import { Badge, Card, CardHead, EmptyState, StatCard, Td, Th } from "@/components/ui";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PROPERTY_STATUS_LABEL,
  PROPERTY_TYPE_LABEL,
  STATUS_TONE,
  formatDate,
  numberID,
  rupiah,
  rupiahShort,
} from "@/lib/format";

const LEVEL_TONE = { kritis: "red", peringatan: "amber", info: "blue" } as const;

const CATEGORY_LABEL: Record<string, string> = {
  stok: "Stok",
  kadaluarsa: "Listing",
  pembayaran: "Pembayaran",
  unit_menganggur: "Unit Menganggur",
};

export function DashboardView() {
  const { data, loading } = useApp();

  if (loading && !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }
  if (!data) {
    return <EmptyState icon="⚠️" title="Data belum tersedia" desc="Muat ulang halaman saat koneksi aktif." />;
  }

  const { kpi, salesByMonth, byType, byStatus, topAgents, alerts, recentOrders, staleProperties } =
    data.dashboard;
  const maxSales = Math.max(1, ...salesByMonth.map((m) => m.total));
  const critical = alerts.filter((a) => a.level === "kritis").length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Ringkasan operasional · Palembang
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              Selamat datang, {data.user.name.split(" ")[0]} 👋
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-emerald-50">
              {critical > 0
                ? `Ada ${critical} peringatan kritis yang perlu ditindak sekarang — cek panel peringatan di bawah.`
                : "Tidak ada peringatan kritis. Inventaris dan piutang dalam kondisi terkendali."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/inventaris"
              className="rounded-lg bg-white/15 px-3.5 py-2 text-xs font-bold backdrop-blur transition hover:bg-white/25"
            >
              Kelola Inventaris
            </Link>
            <Link
              href="/laporan"
              className="rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
            >
              Lihat Laporan
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Unit Tersedia" value={`${numberID(kpi.availableUnits)} unit`} sub={`${numberID(kpi.totalProperty)} jenis unit terdaftar`} tone="green" icon="🏘️" />
        <StatCard label="Nilai Stok Aktif" value={rupiahShort(kpi.stockValue)} sub={`Potensi omzet ${rupiahShort(kpi.potentialRevenue)}`} tone="blue" icon="💰" />
        <StatCard label="Pendapatan Bulan Ini" value={rupiahShort(kpi.revenueThisMonth)} sub={`Total ${rupiahShort(kpi.revenueTotal)}`} tone="violet" icon="📈" />
        <StatCard label="Piutang Belum Tertagih" value={rupiahShort(kpi.receivable)} sub={`${numberID(kpi.activeOrders)} transaksi berjalan`} tone="amber" icon="🧾" />
        <StatCard label="Unit Terjual" value={`${numberID(kpi.soldUnits)} unit`} sub={`${numberID(kpi.bookedUnits)} unit di booking`} tone="green" icon="✅" />
        <StatCard label="Potensi Pemborosan" value={rupiahShort(kpi.wasteValue)} sub={`${numberID(kpi.staleUnits)} unit menganggur >120 hari`} tone="red" icon="⚠️" />
        <StatCard label="Pelanggan" value={numberID(kpi.customers)} sub="Profil & preferensi tersimpan" tone="slate" icon="👥" />
        <StatCard label="Peringatan Aktif" value={numberID(alerts.length)} sub={`${critical} kritis · ${alerts.filter((a) => a.level === "peringatan").length} peringatan`} tone="amber" icon="🔔" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHead title="Tren Pembayaran Diterima" desc="6 bulan terakhir berdasarkan pembayaran tercatat" />
          <div className="flex h-56 items-end gap-3 px-5 pb-5 pt-6">
            {salesByMonth.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500">{rupiahShort(m.total)}</span>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400"
                  style={{ height: `${Math.max(4, (m.total / maxSales) * 150)}px` }}
                  title={`${m.count} transaksi`}
                />
                <span className="text-[10px] font-semibold text-slate-500">{m.month}</span>
                <span className="text-[10px] text-slate-400">{m.count} trx</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Status Inventaris" desc="Distribusi unit per status" />
          <div className="space-y-3 p-5">
            {byStatus.map((s) => {
              const total = byStatus.reduce((sum, x) => sum + x.count, 0) || 1;
              return (
                <div key={s.status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{PROPERTY_STATUS_LABEL[s.status]}</span>
                    <span className="text-slate-500">
                      {s.count} unit · {Math.round((s.count / total) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        s.status === "tersedia"
                          ? "bg-emerald-500"
                          : s.status === "terjual"
                            ? "bg-sky-500"
                            : s.status === "booking"
                              ? "bg-amber-500"
                              : s.status === "tertahan"
                                ? "bg-orange-500"
                                : "bg-slate-400"
                      }`}
                      style={{ width: `${(s.count / total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Komposisi per jenis</p>
              {byType.map((t) => (
                <div key={t.type} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{PROPERTY_TYPE_LABEL[t.type]}</span>
                  <span className="text-slate-500">
                    {t.total} unit · {rupiahShort(t.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Peringatan Inventaris & Pembayaran"
            desc="Stok menipis, listing kadaluarsa, unit menganggur, jatuh tempo"
          />
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {alerts.length === 0 ? (
              <EmptyState icon="🎉" title="Tidak ada peringatan" desc="Semua indikator dalam batas aman." />
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="flex gap-3 px-5 py-3">
                  <Badge tone={LEVEL_TONE[a.level]}>{CATEGORY_LABEL[a.category] ?? a.category}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.description}</p>
                  </div>
                  <Link href={a.link} className="self-center text-xs font-bold text-emerald-700 hover:underline">
                    Buka →
                  </Link>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHead title="Performa Agen" desc="Total pembayaran diterima per agen" />
            <div className="divide-y divide-slate-100">
              {topAgents.length === 0 ? (
                <EmptyState icon="🤝" title="Belum ada transaksi" />
              ) : (
                topAgents.map((a, i) => (
                  <div key={a.name} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                        <p className="text-[11px] text-slate-500">{a.count} transaksi</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{rupiahShort(a.total)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Unit Paling Lama Menganggur" desc="Prioritas promosi / penyesuaian harga" />
            <div className="divide-y divide-slate-100">
              {staleProperties.length === 0 ? (
                <EmptyState icon="👍" title="Tidak ada unit menganggur" />
              ) : (
                staleProperties.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {p.code} · listing sejak {formatDate(p.listedAt)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{rupiahShort(p.price)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHead
          title="Transaksi Terbaru"
          desc="6 transaksi terakhir"
          action={
            <Link href="/pesanan" className="text-xs font-bold text-emerald-700 hover:underline">
              Semua transaksi →
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                <Th>Kode</Th>
                <Th>Tanggal</Th>
                <Th>Pelanggan</Th>
                <Th>Unit</Th>
                <Th>Nilai</Th>
                <Th>Status</Th>
                <Th>Pembayaran</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <Td className="font-semibold">{o.code}</Td>
                  <Td>{formatDate(o.orderDate)}</Td>
                  <Td>{o.customerName ?? "-"}</Td>
                  <Td className="max-w-[220px] truncate">{o.propertyName ?? "-"}</Td>
                  <Td>{rupiah(o.totalPrice)}</Td>
                  <Td>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[o.status]}`}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </span>
                  </Td>
                  <Td>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[o.paymentStatus]}`}>
                      {PAYMENT_STATUS_LABEL[o.paymentStatus]}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
