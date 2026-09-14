"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/SyncProvider";
import {
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  StatCard,
  TextArea,
  Td,
  Th,
} from "@/components/ui";
import {
  LEAD_SOURCE_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PROPERTY_TYPE_LABEL,
  STATUS_TONE,
  formatDate,
  numberID,
  rupiah,
  rupiahShort,
} from "@/lib/format";
import { can } from "@/lib/rbac";
import type { CustomerDTO, LeadSource, PropertyType } from "@/lib/types";

type Form = {
  name: string; phone: string; email: string; address: string; nik: string; source: LeadSource;
  preferredType: string; preferredLocation: string; budgetMin: string; budgetMax: string;
  preferenceNotes: string; notes: string; consentPdp: boolean;
};

const emptyForm: Form = {
  name: "", phone: "", email: "", address: "", nik: "", source: "walk_in", preferredType: "",
  preferredLocation: "", budgetMin: "", budgetMax: "", preferenceNotes: "", notes: "", consentPdp: false,
};

export function CustomerView() {
  const { data, mutate, notify } = useApp();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("semua");
  const [consent, setConsent] = useState("semua");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDTO | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [confirm, setConfirm] = useState<CustomerDTO | null>(null);
  const [saving, setSaving] = useState(false);

  const role = data?.user.role;
  const customers = useMemo(() => data?.customers ?? [], [data]);
  const orders = useMemo(() => data?.orders ?? [], [data]);

  const stats = useMemo(() => {
    const map = new Map<number, { count: number; total: number; paid: number; last: string }>();
    for (const o of orders) {
      if (o.status === "dibatalkan") continue;
      const cur = map.get(o.customerId) ?? { count: 0, total: 0, paid: 0, last: "" };
      cur.count += 1;
      cur.total += o.totalPrice;
      cur.paid += o.paidAmount;
      if (o.orderDate > cur.last) cur.last = o.orderDate;
      map.set(o.customerId, cur);
    }
    return map;
  }, [orders]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (needle) {
        const hay = `${c.name} ${c.phone} ${c.email ?? ""} ${c.preferredLocation ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (source !== "semua" && c.source !== source) return false;
      if (consent === "ya" && !c.consentPdp) return false;
      if (consent === "belum" && c.consentPdp) return false;
      return true;
    });
  }, [customers, q, source, consent]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(c: CustomerDTO) {
    setEditing(c);
    setForm({
      name: c.name, phone: c.phone, email: c.email ?? "", address: c.address ?? "", nik: c.nik ?? "",
      source: c.source, preferredType: c.preferredType ?? "", preferredLocation: c.preferredLocation ?? "",
      budgetMin: String(c.budgetMin || ""), budgetMax: String(c.budgetMax || ""),
      preferenceNotes: c.preferenceNotes ?? "", notes: c.notes ?? "", consentPdp: c.consentPdp,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) {
      notify("Nama dan nomor telepon wajib diisi", "err");
      return;
    }
    setSaving(true);
    const payload = { ...form };
    const res = await mutate(
      editing ? { kind: "customer.update", id: editing.id, payload } : { kind: "customer.create", payload },
    );
    setSaving(false);
    if (!res.ok) {
      notify(res.error ?? "Gagal menyimpan pelanggan", "err");
      return;
    }
    setOpen(false);
    notify(editing ? "Data pelanggan diperbarui" : "Pelanggan baru ditambahkan", "ok");
  }

  async function remove() {
    if (!confirm) return;
    const res = await mutate({ kind: "customer.delete", id: confirm.id });
    setConfirm(null);
    notify(res.ok ? "Pelanggan dihapus" : (res.error ?? "Gagal menghapus"), res.ok ? "ok" : "err");
  }

  const noConsent = customers.filter((c) => !c.consentPdp).length;
  const totalSpend = [...stats.values()].reduce((s, v) => s + v.paid, 0);
  const history = editing ? orders.filter((o) => o.customerId === editing.id) : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Pelanggan" value={numberID(customers.length)} sub="Profil tersimpan" tone="slate" icon="👥" />
        <StatCard label="Pernah Bertransaksi" value={numberID(stats.size)} sub={`${customers.length - stats.size} prospek baru`} tone="green" icon="🤝" />
        <StatCard label="Nilai Pembayaran Diterima" value={rupiahShort(totalSpend)} sub="Akumulasi semua pelanggan" tone="blue" icon="💰" />
        <StatCard label="Belum Setuju PDP" value={numberID(noConsent)} sub="Perlu persetujuan pemrosesan data" tone={noConsent > 0 ? "amber" : "slate"} icon="🔒" />
      </div>

      <Card>
        <CardHead
          title="Manajemen Pelanggan"
          desc="Profil, preferensi properti, riwayat transaksi, dan status pembayaran"
          action={
            <div className="flex flex-wrap gap-2">
              {can(role, "report.export") ? (
                <a href="/api/export?type=pelanggan" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  ⬇ Ekspor CSV
                </a>
              ) : null}
              {can(role, "customer.edit") ? <Button onClick={openCreate}>+ Tambah Pelanggan</Button> : null}
            </div>
          }
        />

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 md:grid-cols-3">
          <Field label="Cari">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama, telepon, email, lokasi" />
          </Field>
          <Field label="Sumber lead">
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="semua">Semua sumber</option>
              {Object.entries(LEAD_SOURCE_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Persetujuan PDP">
            <Select value={consent} onChange={(e) => setConsent(e.target.value)}>
              <option value="semua">Semua</option>
              <option value="ya">Sudah setuju</option>
              <option value="belum">Belum setuju</option>
            </Select>
          </Field>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-50">
              <tr>
                <Th>Pelanggan</Th><Th>Kontak</Th><Th>Preferensi</Th><Th>Budget</Th>
                <Th>Sumber</Th><Th>Transaksi</Th><Th>PDP</Th><Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="max-w-[220px] truncate text-xs text-slate-500">{c.address ?? "-"}</p>
                    </Td>
                    <Td className="text-xs">
                      <p className="font-medium text-slate-700">{c.phone}</p>
                      <p className="text-slate-500">{c.email ?? "-"}</p>
                    </Td>
                    <Td className="text-xs">
                      <p>{c.preferredType ? PROPERTY_TYPE_LABEL[c.preferredType] : "-"}</p>
                      <p className="max-w-[180px] truncate text-slate-500">{c.preferredLocation ?? "-"}</p>
                    </Td>
                    <Td className="text-xs">
                      {c.budgetMax > 0 ? (
                        <>
                          <p>{rupiahShort(c.budgetMin)} – {rupiahShort(c.budgetMax)}</p>
                        </>
                      ) : (
                        <span className="text-slate-400">belum ditentukan</span>
                      )}
                    </Td>
                    <Td className="text-xs">{LEAD_SOURCE_LABEL[c.source]}</Td>
                    <Td className="text-xs">
                      {s ? (
                        <>
                          <p className="font-semibold text-slate-800">{s.count} transaksi</p>
                          <p className="text-slate-500">dibayar {rupiahShort(s.paid)}</p>
                          <p className="text-slate-400">terakhir {formatDate(s.last)}</p>
                        </>
                      ) : (
                        <Badge tone="slate">Prospek</Badge>
                      )}
                    </Td>
                    <Td>
                      {c.consentPdp ? <Badge tone="green">Setuju</Badge> : <Badge tone="amber">Belum</Badge>}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {can(role, "customer.edit") ? (
                          <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Detail / Ubah</Button>
                        ) : null}
                        {can(role, "customer.delete") ? (
                          <Button size="sm" variant="danger" onClick={() => setConfirm(c)}>Hapus</Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <EmptyState icon="🔍" title="Pelanggan tidak ditemukan" desc="Coba kata kunci lain atau tambahkan pelanggan baru." /> : null}
      </Card>

      <Modal
        open={open}
        wide
        onClose={() => setOpen(false)}
        title={editing ? `Detail Pelanggan — ${editing.name}` : "Tambah Pelanggan Baru"}
        desc="Data pribadi hanya dipakai untuk keperluan pemasaran properti dan dicatat pada jejak audit."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Pelanggan"}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama lengkap *">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ahmad Fauzi" />
          </Field>
          <Field label="Nomor WhatsApp / telepon *">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0812 3456 7890" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="nama@mail.com" />
          </Field>
          <Field label="NIK (opsional)" hint="Disimpan terenkripsi pada laporan — hanya untuk dokumen transaksi">
            <Input value={form.nik} onChange={(e) => set("nik", e.target.value)} placeholder="167102xxxxxxxxxx" />
          </Field>
          <Field label="Alamat" className="sm:col-span-2">
            <TextArea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Jl. Rajawali No. 8, Palembang" />
          </Field>
          <Field label="Sumber lead">
            <Select value={form.source} onChange={(e) => set("source", e.target.value as LeadSource)}>
              {Object.entries(LEAD_SOURCE_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Jenis properti diminati">
            <Select value={form.preferredType} onChange={(e) => set("preferredType", e.target.value)}>
              <option value="">Belum ditentukan</option>
              {Object.entries(PROPERTY_TYPE_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Lokasi diminati">
            <Input value={form.preferredLocation} onChange={(e) => set("preferredLocation", e.target.value)} placeholder="Jakabaring / Seberang Ulu" />
          </Field>
          <Field label="Catatan preferensi" className="sm:col-span-2">
            <TextArea rows={2} value={form.preferenceNotes} onChange={(e) => set("preferenceNotes", e.target.value)} placeholder="Butuh kavling siap bangun SHM, lebar muka 8m" />
          </Field>
          <Field label="Budget minimum (Rp)">
            <Input type="number" min={0} value={form.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} placeholder="200000000" />
          </Field>
          <Field label="Budget maksimum (Rp)">
            <Input type="number" min={0} value={form.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} placeholder="400000000" />
          </Field>
          <Field label="Catatan internal" className="sm:col-span-2">
            <TextArea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Follow up tiap Senin, minat cluster dekat sekolah" />
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.consentPdp}
              onChange={(e) => set("consentPdp", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            <span className="text-xs text-slate-600">
              Pelanggan telah memberikan <strong>persetujuan eksplisit</strong> untuk pemrosesan data pribadi
              sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (hak akses, koreksi, penghapusan,
              dan penarikan persetujuan).
            </span>
          </label>
        </div>

        {editing ? (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Riwayat transaksi</p>
            <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px]">
                <thead className="bg-slate-50">
                  <tr><Th>Kode</Th><Th>Tanggal</Th><Th>Unit</Th><Th>Nilai</Th><Th>Status</Th><Th>Pembayaran</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? (
                    <tr><Td className="text-center text-xs text-slate-400">Belum ada transaksi</Td></tr>
                  ) : (
                    history.map((o) => (
                      <tr key={o.id}>
                        <Td className="font-semibold">{o.code}</Td>
                        <Td>{formatDate(o.orderDate)}</Td>
                        <Td className="max-w-[200px] truncate">{o.propertyName ?? "-"}</Td>
                        <Td>{rupiah(o.totalPrice)}</Td>
                        <Td><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span></Td>
                        <Td><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[o.paymentStatus]}`}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</span></Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Hapus data pelanggan?"
        desc="Sesuai hak penghapusan data pribadi (UU PDP), data akan dihapus permanen."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>Batal</Button>
            <Button variant="danger" onClick={remove}>Ya, hapus</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Semua riwayat transaksi milik <strong>{confirm?.name}</strong> juga akan dihapus. Tindakan ini
          dicatat pada jejak audit.
        </p>
      </Modal>
    </div>
  );
}
