"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/SyncProvider";
import { Button, Card, CardHead, EmptyState, Field, Input, Select, StatCard, Td, Th } from "@/components/ui";
import { inventoryHealth, overdueOrders } from "@/lib/analytics";
import {
  LEAD_SOURCE_LABEL, ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, PAYMENT_STATUS_LABEL,
  PROPERTY_STATUS_LABEL, PROPERTY_TYPE_LABEL, daysBetween, formatDate, numberID, rupiah, rupiahShort,
} from "@/lib/format";
import { can } from "@/lib/rbac";

type Tab = "inventaris" | "penjualan" | "pelanggan" | "pemborosan";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "inventaris", label: "Inventaris", icon: "🏘️" },
  { key: "penjualan", label: "Penjualan", icon: "📈" },
  { key: "pelanggan", label: "Pelanggan", icon: "👥" },
  { key: "pemborosan", label: "Pemborosan & Risiko", icon: "⚠️" },
];

export function ReportsView() {
  const { data, notify } = useApp();
  const today = useState(() => new Date().toISOString().slice(0, 10))[0];
  const start = useState(() => new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10))[0];
  const [tab, setTab] = useState<Tab>("inventaris");
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const properties = useMemo(() => data?.properties ?? [], [data]);
  const customers = useMemo(() => data?.customers ?? [], [data]);
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const canExport = can(data?.user.role, "report.export");

  const filteredOrders = useMemo(
    () => orders.filter((o) => o.orderDate >= from && o.orderDate <= to),
    [orders, from, to],
  );

  const health = useMemo(() => inventoryHealth(properties), [properties]);
  const overdue = useMemo(() => overdueOrders(orders), [orders]);

  const sales = filteredOrders.filter((o) => o.status !== "dibatalkan");
  const salesValue = sales.reduce((s, o) => s + o.totalPrice, 0);
  const salesPaid = sales.reduce((s, o) => s + o.paidAmount, 0);
  const wasteValue = health.stale.reduce((s, p) => s + p.cost * p.quantity, 0);

  const wasteRows = [
    ...health.stale.map((p) => ({
      kategori: "Unit menganggur",
      kode: p.code,
      deskripsi: p.name,
      nilai: p.cost * p.quantity,
      keterangan: `${p.listedAt ? daysBetween(p.listedAt, new Date()) : 0} hari belum terjual`,
    })),
    ...health.expired.map((p) => ({
      kategori: "Listing kadaluarsa",
      kode: p.code,
      deskripsi: p.name,
      nilai: p.price * p.quantity,
      keterangan: `Berakhir ${p.listingExpiresAt ?? "-"}`,
    })),
    ...health.expiringSoon.map((p) => ({
      kategori: "Listing hampir kadaluarsa",
      kode: p.code,
      deskripsi: p.name,
      nilai: p.price * p.quantity,
      keterangan: `Berakhir ${p.listingExpiresAt ?? "-"}`,
    })),
    ...health.lowStock.map((p) => ({
      kategori: "Stok menipis",
      kode: p.code,
      deskripsi: p.name,
      nilai: p.price * p.quantity,
      keterangan: `Sisa ${p.quantity} unit (min ${p.minStock})`,
    })),
    ...overdue.map((o) => ({
      kategori: "Piutang jatuh tempo",
      kode: o.code,
      deskripsi: o.customerName ?? "-",
      nilai: Math.max(o.totalPrice - o.paidAmount, 0),
      keterangan: `Jatuh tempo ${o.nextPaymentDue ?? "-"}`,
    })),
  ];

  async function exportPDF() {
    if (!canExport) {
      notify("Peran Anda tidak memiliki izin ekspor", "err");
      return;
    }
    setBusy(true);
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFillColor(5, 150, 105);
      doc.rect(0, 0, 297, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text("Kavlingo Palembang", 14, 10);
      doc.setFontSize(9);
      doc.text("Laporan Manajemen Pemasaran & Penjualan Properti", 14, 16);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `Periode: ${formatDate(from)} s/d ${formatDate(to)}  |  Dibuat: ${new Date().toLocaleString("id-ID")}  |  Oleh: ${data?.user.name}`,
        14,
        29,
      );

      const summary: (string | number)[][] = [
        ["Jenis unit terdaftar", numberID(properties.length)],
        ["Unit tersedia", numberID(properties.filter((p) => p.status === "tersedia").reduce((s, p) => s + p.quantity, 0))],
        ["Nilai stok aktif", rupiah(properties.filter((p) => p.status !== "terjual").reduce((s, p) => s + p.price * p.quantity, 0))],
        ["Jumlah transaksi periode", numberID(sales.length)],
        ["Nilai transaksi periode", rupiah(salesValue)],
        ["Pembayaran diterima", rupiah(salesPaid)],
        ["Piutang belum tertagih", rupiah(Math.max(salesValue - salesPaid, 0))],
        ["Unit menganggur", numberID(health.stale.length)],
        ["Potensi pemborosan (modal terikat)", rupiah(wasteValue)],
        ["Total pelanggan", numberID(customers.length)],
      ];
      autoTable(doc, {
        head: [["Ringkasan", "Nilai"]],
        body: summary,
        startY: 34,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [5, 150, 105] },
      });

      let title = "";
      let tableHead: string[][] = [];
      let tableBody: (string | number)[][] = [];

      if (tab === "inventaris") {
        title = "Rincian Inventaris Properti";
        tableHead = [["Kode", "Nama", "Jenis", "Status", "Kecamatan", "Luas (m2)", "Stok", "Min", "Harga", "Kadaluarsa Listing"]];
        tableBody = properties.map((p) => [
          p.code, p.name, PROPERTY_TYPE_LABEL[p.type], PROPERTY_STATUS_LABEL[p.status], p.district ?? "-",
          `${numberID(p.landArea)}${p.buildingArea ? `/${numberID(p.buildingArea)}` : ""}`,
          p.quantity, p.minStock, rupiah(p.price), p.listingExpiresAt ?? "-",
        ]);
      } else if (tab === "penjualan") {
        title = `Rincian Penjualan (${formatDate(from)} - ${formatDate(to)})`;
        tableHead = [["Kode", "Tanggal", "Pelanggan", "Unit", "Skema", "Nilai", "Dibayar", "Sisa", "Status"]];
        tableBody = filteredOrders.map((o) => [
          o.code, formatDate(o.orderDate), o.customerName ?? "-", o.propertyCode ?? "-",
          ORDER_TYPE_LABEL[o.orderType], rupiah(o.totalPrice), rupiah(o.paidAmount),
          rupiah(Math.max(o.totalPrice - o.paidAmount, 0)),
          `${ORDER_STATUS_LABEL[o.status]} / ${PAYMENT_STATUS_LABEL[o.paymentStatus]}`,
        ]);
      } else if (tab === "pelanggan") {
        title = "Rincian Pelanggan";
        tableHead = [["Nama", "Telepon", "Email", "Sumber", "Preferensi", "Lokasi diminati", "Budget", "PDP"]];
        tableBody = customers.map((c) => [
          c.name, c.phone, c.email ?? "-", LEAD_SOURCE_LABEL[c.source],
          c.preferredType ? PROPERTY_TYPE_LABEL[c.preferredType] : "-",
          c.preferredLocation ?? "-",
          c.budgetMax ? `${rupiahShort(c.budgetMin)} - ${rupiahShort(c.budgetMax)}` : "-",
          c.consentPdp ? "Setuju" : "Belum",
        ]);
      } else {
        title = "Laporan Pemborosan & Risiko";
        tableHead = [["Kategori", "Kode", "Deskripsi", "Nilai terdampak", "Keterangan"]];
        tableBody = wasteRows.map((r) => [r.kategori, r.kode, r.deskripsi, rupiah(r.nilai), r.keterangan]);
      }

      const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 34;
      doc.setFontSize(11);
      doc.setTextColor(15, 118, 110);
      doc.text(title, 14, lastY + 8);
      autoTable(doc, {
        head: tableHead,
        body: tableBody.length > 0 ? tableBody : [["-", "-", "-", "-", "-", "-", "-", "-", "-"]],
        startY: lastY + 12,
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 1.6 },
        headStyles: { fillColor: [13, 148, 136] },
      });

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Dokumen ini mengandung data pribadi - perlakukan sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.",
        14,
        200,
      );
      doc.save(`Kavlingo-Laporan-${tab}-${from}_${to}.pdf`);
      notify("Laporan PDF berhasil diunduh", "ok");
    } catch {
      notify("Gagal membuat PDF. Coba lagi saat koneksi stabil.", "err");
    } finally {
      setBusy(false);
    }
  }

  const csvType = tab === "pemborosan" ? "pemborosan" : tab;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          title="Laporan & Ekspor"
          desc="Analisis inventaris, penjualan, pelanggan, serta potensi pemborosan modal"
          action={
            <div className="flex flex-wrap gap-2">
              {canExport ? (
                <>
                  <a
                    href={`/api/export?type=${csvType}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    ⬇ Ekspor CSV
                  </a>
                  <Button onClick={exportPDF} disabled={busy}>
                    {busy ? "Menyiapkan…" : "🖨 Ekspor PDF"}
                  </Button>
                </>
              ) : (
                <span className="text-xs text-slate-400">Peran Anda hanya dapat melihat laporan</span>
              )}
            </div>
          }
        />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Periode dari">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Periode sampai">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Jenis laporan">
            <Select value={tab} onChange={(e) => setTab(e.target.value as Tab)}>
              {TABS.map((t) => (<option key={t.key} value={t.key}>{t.icon} {t.label}</option>))}
            </Select>
          </Field>
          <div className="flex items-end">
            <p className="text-[11px] text-slate-500">
              Periode memengaruhi laporan penjualan. Inventaris &amp; pemborosan memakai data terkini.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Nilai Transaksi" value={rupiahShort(salesValue)} sub={`${numberID(sales.length)} transaksi pada periode`} tone="blue" icon="🧾" />
        <StatCard label="Pembayaran Diterima" value={rupiahShort(salesPaid)} sub={`Sisa piutang ${rupiahShort(Math.max(salesValue - salesPaid, 0))}`} tone="green" icon="✅" />
        <StatCard label="Modal Terikat (Unit Menganggur)" value={rupiahShort(wasteValue)} sub={`${numberID(health.stale.length)} unit >120 hari`} tone="red" icon="⚠️" />
        <StatCard label="Risiko Terpantau" value={numberID(wasteRows.length)} sub="Stok, listing, dan piutang" tone="amber" icon="🔔" />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              tab === t.key ? "bg-emerald-600 text-white shadow" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHead
          title={TABS.find((t) => t.key === tab)?.label ?? ""}
          desc={tab === "penjualan" ? `Periode ${formatDate(from)} — ${formatDate(to)}` : "Data terkini"}
        />
        <div className="overflow-x-auto">
          {tab === "inventaris" ? (
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50">
                <tr><Th>Kode</Th><Th>Nama</Th><Th>Jenis</Th><Th>Status</Th><Th>Kecamatan</Th><Th>Stok</Th><Th>Harga</Th><Th>Kadaluarsa</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {properties.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-semibold">{p.code}</Td>
                    <Td className="max-w-[220px] truncate">{p.name}</Td>
                    <Td>{PROPERTY_TYPE_LABEL[p.type]}</Td>
                    <Td>{PROPERTY_STATUS_LABEL[p.status]}</Td>
                    <Td>{p.district ?? "-"}</Td>
                    <Td>{p.quantity} / min {p.minStock}</Td>
                    <Td>{rupiah(p.price)}</Td>
                    <Td>{p.listingExpiresAt ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {tab === "penjualan" ? (
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-50">
                <tr><Th>Kode</Th><Th>Tanggal</Th><Th>Pelanggan</Th><Th>Unit</Th><Th>Skema</Th><Th>Nilai</Th><Th>Dibayar</Th><Th>Sisa</Th><Th>Status</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <Td className="font-semibold">{o.code}</Td>
                    <Td>{formatDate(o.orderDate)}</Td>
                    <Td>{o.customerName ?? "-"}</Td>
                    <Td className="max-w-[200px] truncate">{o.propertyName ?? "-"}</Td>
                    <Td>{ORDER_TYPE_LABEL[o.orderType]}</Td>
                    <Td>{rupiah(o.totalPrice)}</Td>
                    <Td>{rupiah(o.paidAmount)}</Td>
                    <Td>{rupiah(Math.max(o.totalPrice - o.paidAmount, 0))}</Td>
                    <Td>{ORDER_STATUS_LABEL[o.status]} · {PAYMENT_STATUS_LABEL[o.paymentStatus]}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {tab === "pelanggan" ? (
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50">
                <tr><Th>Nama</Th><Th>Telepon</Th><Th>Sumber</Th><Th>Preferensi</Th><Th>Lokasi</Th><Th>Budget</Th><Th>PDP</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-semibold">{c.name}</Td>
                    <Td>{c.phone}</Td>
                    <Td>{LEAD_SOURCE_LABEL[c.source]}</Td>
                    <Td>{c.preferredType ? PROPERTY_TYPE_LABEL[c.preferredType] : "-"}</Td>
                    <Td>{c.preferredLocation ?? "-"}</Td>
                    <Td>{c.budgetMax ? `${rupiahShort(c.budgetMin)} – ${rupiahShort(c.budgetMax)}` : "-"}</Td>
                    <Td>{c.consentPdp ? "Setuju" : "Belum"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {tab === "pemborosan" ? (
            <table className="w-full min-w-[860px]">
              <thead className="bg-slate-50">
                <tr><Th>Kategori</Th><Th>Kode</Th><Th>Deskripsi</Th><Th>Nilai Terdampak</Th><Th>Keterangan</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wasteRows.map((r, i) => (
                  <tr key={`${r.kode}-${i}`}>
                    <Td className="font-semibold">{r.kategori}</Td>
                    <Td>{r.kode}</Td>
                    <Td className="max-w-[260px] truncate">{r.deskripsi}</Td>
                    <Td>{rupiah(r.nilai)}</Td>
                    <Td className="text-xs text-slate-500">{r.keterangan}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        {wasteRows.length === 0 && tab === "pemborosan" ? (
          <EmptyState icon="🎉" title="Tidak ada pemborosan terdeteksi" desc="Semua unit aktif dipasarkan dan piutang terkendali." />
        ) : null}
      </Card>
    </div>
  );
}
