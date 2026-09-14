import { can, getSessionUser, writeAudit } from "@/lib/auth";
import { listCustomers, listOrders, listProperties } from "@/lib/data";
import {
  LEAD_SOURCE_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
  PROPERTY_STATUS_LABEL,
  PROPERTY_TYPE_LABEL,
  daysBetween,
} from "@/lib/format";
import { inventoryHealth, overdueOrders } from "@/lib/analytics";
import { csvResponse, toCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Tidak terautentikasi" }, { status: 401 });
  if (!can(user.role, "report.export")) return Response.json({ error: "Akses ditolak" }, { status: 403 });

  const type = new URL(request.url).searchParams.get("type") ?? "inventaris";
  const stamp = new Date().toISOString().slice(0, 10);
  let filename = `laporan-${type}-${stamp}.csv`;
  let csv = "";

  if (type === "inventaris") {
    const rows = await listProperties();
    csv = toCSV(rows as unknown as Record<string, unknown>[], [
      { key: "code", label: "Kode Unit" },
      { key: "name", label: "Nama Unit" },
      { key: "type", label: "Jenis" },
      { key: "status", label: "Status" },
      { key: "project", label: "Proyek" },
      { key: "district", label: "Kecamatan" },
      { key: "city", label: "Kota" },
      { key: "landArea", label: "Luas Tanah (m2)" },
      { key: "buildingArea", label: "Luas Bangunan (m2)" },
      { key: "quantity", label: "Jumlah Unit" },
      { key: "minStock", label: "Batas Stok Minimum" },
      { key: "price", label: "Harga Jual (Rp)" },
      { key: "cost", label: "Harga Modal (Rp)" },
      { key: "monthlyFee", label: "Biaya Perawatan/Bulan (Rp)" },
      { key: "listedAt", label: "Tanggal Listing" },
      { key: "listingExpiresAt", label: "Kadaluarsa Listing" },
      { key: "certificate", label: "Sertifikat" },
      { key: "notes", label: "Catatan" },
    ]);
  } else if (type === "penjualan") {
    const rows = await listOrders();
    filename = `laporan-penjualan-${stamp}.csv`;
    csv = toCSV(
      rows.map((o) => ({
        code: o.code,
        orderDate: o.orderDate,
        customer: o.customerName ?? "",
        property: `${o.propertyCode ?? ""} — ${o.propertyName ?? ""}`,
        orderType: ORDER_TYPE_LABEL[o.orderType],
        status: ORDER_STATUS_LABEL[o.status],
        paymentStatus: PAYMENT_STATUS_LABEL[o.paymentStatus],
        quantity: o.quantity,
        totalPrice: o.totalPrice,
        paidAmount: o.paidAmount,
        outstanding: Math.max(o.totalPrice - o.paidAmount, 0),
        nextPaymentDue: o.nextPaymentDue ?? "",
        agent: o.agentName ?? "",
      })),
      [
        { key: "code", label: "Kode Transaksi" },
        { key: "orderDate", label: "Tanggal" },
        { key: "customer", label: "Pelanggan" },
        { key: "property", label: "Unit Properti" },
        { key: "orderType", label: "Skema" },
        { key: "status", label: "Status" },
        { key: "paymentStatus", label: "Status Pembayaran" },
        { key: "quantity", label: "Jumlah" },
        { key: "totalPrice", label: "Nilai Transaksi (Rp)" },
        { key: "paidAmount", label: "Sudah Dibayar (Rp)" },
        { key: "outstanding", label: "Piutang (Rp)" },
        { key: "nextPaymentDue", label: "Jatuh Tempo Berikutnya" },
        { key: "agent", label: "Agen" },
      ],
    );
  } else if (type === "pelanggan") {
    const rows = await listCustomers();
    filename = `laporan-pelanggan-${stamp}.csv`;
    csv = toCSV(
      rows.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email ?? "",
        address: c.address ?? "",
        source: LEAD_SOURCE_LABEL[c.source],
        preferredType: c.preferredType ? PROPERTY_TYPE_LABEL[c.preferredType] : "",
        preferredLocation: c.preferredLocation ?? "",
        budgetMin: c.budgetMin,
        budgetMax: c.budgetMax,
        preferenceNotes: c.preferenceNotes ?? "",
        consentPdp: c.consentPdp ? "Ya" : "Belum",
        createdAt: c.createdAt.slice(0, 10),
      })),
      [
        { key: "name", label: "Nama" },
        { key: "phone", label: "Telepon" },
        { key: "email", label: "Email" },
        { key: "address", label: "Alamat" },
        { key: "source", label: "Sumber Lead" },
        { key: "preferredType", label: "Preferensi Jenis Properti" },
        { key: "preferredLocation", label: "Preferensi Lokasi" },
        { key: "budgetMin", label: "Budget Minimum (Rp)" },
        { key: "budgetMax", label: "Budget Maksimum (Rp)" },
        { key: "preferenceNotes", label: "Catatan Preferensi" },
        { key: "consentPdp", label: "Persetujuan PDP" },
        { key: "createdAt", label: "Terdaftar Sejak" },
      ],
    );
  } else if (type === "pemborosan") {
    const [props, orders] = await Promise.all([listProperties(), listOrders()]);
    const health = inventoryHealth(props);
    const overdue = overdueOrders(orders);
    const rows = [
      ...health.stale.map((p) => ({
        kategori: "Unit Menganggur",
        kode: p.code,
        deskripsi: p.name,
        nilai: p.cost * p.quantity,
        keterangan: `Terpasang ${p.listedAt ?? "-"} (${p.listedAt ? daysBetween(p.listedAt, new Date()) : 0} hari belum terjual)`,
      })),
      ...[...health.expired, ...health.expiringSoon].map((p) => ({
        kategori: health.expired.includes(p) ? "Listing Kadaluarsa" : "Listing Segera Kadaluarsa",
        kode: p.code,
        deskripsi: p.name,
        nilai: p.price * p.quantity,
        keterangan: `Masa listing berakhir ${p.listingExpiresAt ?? "-"}`,
      })),
      ...health.lowStock.map((p) => ({
        kategori: "Stok Menipis",
        kode: p.code,
        deskripsi: p.name,
        nilai: p.price * p.quantity,
        keterangan: `Sisa ${p.quantity} unit (minimum ${p.minStock})`,
      })),
      ...overdue.map((o) => ({
        kategori: "Piutang Jatuh Tempo",
        kode: o.code,
        deskripsi: o.customerName ?? "-",
        nilai: Math.max(o.totalPrice - o.paidAmount, 0),
        keterangan: `Jatuh tempo ${o.nextPaymentDue ?? "-"}`,
      })),
    ];
    filename = `laporan-pemborosan-risiko-${stamp}.csv`;
    csv = toCSV(rows, [
      { key: "kategori", label: "Kategori" },
      { key: "kode", label: "Kode" },
      { key: "deskripsi", label: "Deskripsi" },
      { key: "nilai", label: "Nilai Terdampak (Rp)" },
      { key: "keterangan", label: "Keterangan" },
    ]);
  } else {
    const rows = await listProperties();
    csv = toCSV(
      rows.map((p) => ({
        code: p.code,
        name: p.name,
        type: PROPERTY_TYPE_LABEL[p.type],
        status: PROPERTY_STATUS_LABEL[p.status],
        quantity: p.quantity,
        price: p.price,
        stockValue: p.price * p.quantity,
      })),
      [
        { key: "code", label: "Kode" },
        { key: "name", label: "Nama" },
        { key: "type", label: "Jenis" },
        { key: "status", label: "Status" },
        { key: "quantity", label: "Unit" },
        { key: "price", label: "Harga" },
        { key: "stockValue", label: "Nilai Stok" },
      ],
    );
  }

  await writeAudit({
    user,
    action: "export",
    entity: "report",
    entityId: type,
    detail: `Ekspor CSV laporan ${type}`,
  });

  return csvResponse(filename, csv);
}
