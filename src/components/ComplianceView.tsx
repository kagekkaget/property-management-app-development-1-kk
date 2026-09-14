"use client";

import { useApp } from "@/components/SyncProvider";
import { Badge, Card, CardHead, EmptyState, StatCard, Td, Th } from "@/components/ui";
import { formatDateTime, numberID } from "@/lib/format";
import { can, ROLE_LABEL } from "@/lib/rbac";

export function ComplianceView() {
  const { data, online, pending, lastSync, syncNow, syncing, refresh } = useApp();
  const customers = data?.customers ?? [];
  const audit = data?.audit ?? [];
  const consent = customers.filter((c) => c.consentPdp).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Persetujuan PDP" value={`${numberID(consent)}/${numberID(customers.length)}`} sub="Pelanggan dengan persetujuan eksplisit" tone={consent === customers.length ? "green" : "amber"} icon="🔒" />
        <StatCard label="Status Koneksi" value={online ? "Online" : "Offline"} sub={pending > 0 ? `${pending} perubahan menunggu sinkron` : "Semua data tersinkron"} tone={online ? "green" : "amber"} icon="📡" />
        <StatCard label="Entri Jejak Audit" value={numberID(audit.length)} sub="60 aktivitas terakhir" tone="slate" icon="📜" />
        <StatCard label="Sinkronisasi Terakhir" value={formatDateTime(lastSync)} sub="Sinkronisasi otomatis tiap 60 detik" tone="blue" icon="🔄" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Kepatuhan Pelindungan Data Pribadi" desc="UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi" />
          <ul className="space-y-3 p-5 text-xs text-slate-600">
            {[
              ["Dasar hukum & persetujuan", "Setiap profil pelanggan mencatat status persetujuan pemrosesan data beserta waktunya (consentPdp & consentAt)."],
              ["Hak subjek data", "Pelanggan dapat meminta akses, koreksi, penghapusan, atau penarikan persetujuan — penghapusan tersedia pada halaman Pelanggan."],
              ["Minimisasi data", "Hanya data yang diperlukan untuk pemasaran dan transaksi properti yang dikumpulkan (nama, kontak, preferensi, NIK opsional)."],
              ["Keamanan", "Kata sandi di-hash scrypt bersalt, sesi menggunakan cookie httpOnly/SameSite, dan otorisasi ditegakkan per peran di setiap endpoint."],
              ["Jejak audit", "Setiap perubahan data dicatat (siapa, kapan, apa) untuk akuntabilitas dan pemeriksaan."],
              ["Retensi & pencadangan", "Cadangan basis data dijalankan otomatis harian dengan retensi 30 hari; data disimpan di infrastruktur regional."],
            ].map(([title, desc]) => (
              <li key={title} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-0.5">{desc}</p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHead title="Ketersediaan & Pemulihan" desc="Skema operasional untuk uptime tinggi" />
            <div className="space-y-3 p-5 text-xs text-slate-600">
              {[
                ["Mode offline", "Data terakhir disimpan di perangkat (localStorage) + service worker cache sehingga aplikasi tetap dapat dibuka tanpa internet."],
                ["Sinkronisasi otomatis", "Perubahan saat offline masuk antrean dan dikirim ulang otomatis ketika koneksi kembali (idempoten via client reference)."],
                ["Skalabilitas", "Arsitektur berbasis API stateless + PostgreSQL dengan connection pooling; siap ditambah replika baca untuk volume lebih besar."],
                ["Pencadangan", "Snapshot basis data harian (retensi 30 hari) via endpoint /api/backup, plus ekspor CSV/PDF manual kapan saja."],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="mt-0.5">{desc}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                >
                  {syncing ? "Menyinkronkan…" : "Sinkronkan sekarang"}
                </button>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Muat ulang data
                </button>
                {can(data?.user.role, "user.manage") ? (
                  <a
                    href="/api/backup"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    ⬇ Unduh cadangan (JSON)
                  </a>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Sesi & Peran Anda" />
            <div className="space-y-2 p-5 text-xs text-slate-600">
              <p className="text-sm font-semibold text-slate-800">{data?.user.name}</p>
              <p>{data?.user.email}</p>
              <Badge tone={data?.user.role === "owner" ? "violet" : data?.user.role === "manager" ? "blue" : "slate"}>
                {data ? ROLE_LABEL[data.user.role] : ""}
              </Badge>
              <p className="mt-2">
                Izin ekspor laporan: {can(data?.user.role, "report.export") ? "ya" : "tidak"} · Izin kelola pengguna:{" "}
                {can(data?.user.role, "user.manage") ? "ya" : "tidak"}
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHead title="Jejak Audit Aktivitas" desc="Rekaman perubahan data untuk akuntabilitas (Pemilik & Manajer)" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr><Th>Waktu</Th><Th>Pengguna</Th><Th>Aksi</Th><Th>Objek</Th><Th>Detail</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.length === 0 ? (
                <tr><Td className="text-center text-xs text-slate-400">Belum ada aktivitas tercatat</Td></tr>
              ) : (
                audit.map((a) => (
                  <tr key={a.id}>
                    <Td className="whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</Td>
                    <Td className="text-xs font-semibold">{a.userName ?? "sistem"}</Td>
                    <Td><Badge tone={a.action === "delete" ? "red" : a.action === "create" ? "green" : "slate"}>{a.action}</Badge></Td>
                    <Td className="text-xs">{a.entity}{a.entityId ? ` #${a.entityId}` : ""}</Td>
                    <Td className="text-xs text-slate-500">{a.detail ?? "-"}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {audit.length === 0 ? <EmptyState icon="📜" title="Jejak audit kosong" /> : null}
      </Card>
    </div>
  );
}
