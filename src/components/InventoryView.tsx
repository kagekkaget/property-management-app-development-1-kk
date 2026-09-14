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
import { inventoryHealth } from "@/lib/analytics";
import {
  PROPERTY_STATUS_LABEL,
  PROPERTY_TYPE_LABEL,
  STATUS_TONE,
  daysBetween,
  formatDate,
  numberID,
  rupiah,
  rupiahShort,
} from "@/lib/format";
import { can } from "@/lib/rbac";
import type { PropertyDTO, PropertyStatus, PropertyType } from "@/lib/types";

type Form = {
  code: string; name: string; type: PropertyType; status: PropertyStatus;
  project: string; cluster: string; address: string; district: string; certificate: string;
  landArea: string; buildingArea: string; quantity: string; minStock: string;
  price: string; cost: string; monthlyFee: string; listedAt: string; listingExpiresAt: string; notes: string;
};

const emptyForm: Form = {
  code: "", name: "", type: "kavling", status: "tersedia", project: "", cluster: "", address: "",
  district: "", certificate: "SHM", landArea: "100", buildingArea: "0", quantity: "1", minStock: "1",
  price: "", cost: "", monthlyFee: "0", listedAt: new Date().toISOString().slice(0, 10),
  listingExpiresAt: "", notes: "",
};

export function InventoryView() {
  const { data, mutate, notify } = useApp();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("semua");
  const [type, setType] = useState("semua");
  const [flag, setFlag] = useState("semua");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyDTO | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [confirm, setConfirm] = useState<PropertyDTO | null>(null);
  const [saving, setSaving] = useState(false);

  const role = data?.user.role;
  const properties = useMemo(() => data?.properties ?? [], [data]);
  const health = useMemo(() => inventoryHealth(properties), [properties]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return properties.filter((p) => {
      if (needle) {
        const hay = `${p.code} ${p.name} ${p.project ?? ""} ${p.district ?? ""} ${p.cluster ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (status !== "semua" && p.status !== status) return false;
      if (type !== "semua" && p.type !== type) return false;
      if (flag === "stok" && !health.lowStock.includes(p)) return false;
      if (flag === "kadaluarsa" && !(health.expired.includes(p) || health.expiringSoon.includes(p))) return false;
      if (flag === "menganggur" && !health.stale.includes(p)) return false;
      return true;
    });
  }, [properties, q, status, type, flag, health]);

  const totalUnits = properties.reduce((s, p) => s + p.quantity, 0);
  const stockValue = properties.filter((p) => p.status !== "terjual").reduce((s, p) => s + p.price * p.quantity, 0);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(p: PropertyDTO) {
    setEditing(p);
    setForm({
      code: p.code, name: p.name, type: p.type, status: p.status, project: p.project ?? "",
      cluster: p.cluster ?? "", address: p.address ?? "", district: p.district ?? "",
      certificate: p.certificate ?? "", landArea: String(p.landArea), buildingArea: String(p.buildingArea),
      quantity: String(p.quantity), minStock: String(p.minStock), price: String(p.price), cost: String(p.cost),
      monthlyFee: String(p.monthlyFee), listedAt: p.listedAt ?? "", listingExpiresAt: p.listingExpiresAt ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      notify("Nama unit wajib diisi", "err");
      return;
    }
    setSaving(true);
    const payload = { ...form, name: form.name.trim() };
    const res = await mutate(
      editing ? { kind: "property.update", id: editing.id, payload } : { kind: "property.create", payload },
    );
    setSaving(false);
    if (!res.ok) {
      notify(res.error ?? "Gagal menyimpan unit", "err");
      return;
    }
    setOpen(false);
    notify(editing ? "Unit berhasil diperbarui" : "Unit baru ditambahkan", "ok");
  }

  async function remove() {
    if (!confirm) return;
    const res = await mutate({ kind: "property.delete", id: confirm.id });
    setConfirm(null);
    notify(res.ok ? "Unit dihapus" : (res.error ?? "Gagal menghapus"), res.ok ? "ok" : "err");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Jenis Unit" value={numberID(properties.length)} sub={`${numberID(totalUnits)} unit total`} tone="slate" icon="🏘️" />
        <StatCard label="Nilai Stok" value={rupiahShort(stockValue)} sub="Unit belum terjual" tone="blue" icon="💰" />
        <StatCard label="Stok Menipis" value={numberID(health.lowStock.length)} sub="Unit di bawah batas minimum" tone="amber" icon="📦" />
        <StatCard label="Listing Kadaluarsa" value={numberID(health.expired.length + health.expiringSoon.length)} sub={`${health.expiringSoon.length} akan berakhir ≤45 hari`} tone="red" icon="⏰" />
      </div>

      <Card>
        <CardHead
          title="Inventaris Properti"
          desc="Kavling, rumah, ruko, apartemen, tanah, dan gudang di Palembang"
          action={
            <div className="flex flex-wrap gap-2">
              {can(role, "report.export") ? (
                <a href="/api/export?type=inventaris" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  ⬇ Ekspor CSV
                </a>
              ) : null}
              {can(role, "inventory.edit") ? <Button onClick={openCreate}>+ Tambah Unit</Button> : null}
            </div>
          }
        />

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 md:grid-cols-4">
          <Field label="Cari">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kode, nama, proyek, kecamatan" />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="semua">Semua status</option>
              {Object.entries(PROPERTY_STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Jenis">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="semua">Semua jenis</option>
              {Object.entries(PROPERTY_TYPE_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Perlu perhatian">
            <Select value={flag} onChange={(e) => setFlag(e.target.value)}>
              <option value="semua">Semua unit</option>
              <option value="stok">Stok menipis</option>
              <option value="kadaluarsa">Listing kadaluarsa / hampir</option>
              <option value="menganggur">Unit menganggur</option>
            </Select>
          </Field>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead className="bg-slate-50">
              <tr>
                <Th>Kode / Nama</Th><Th>Jenis</Th><Th>Lokasi</Th><Th>Luas</Th><Th>Stok</Th>
                <Th>Harga</Th><Th>Listing / Kadaluarsa</Th><Th>Status</Th><Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const low = p.quantity <= p.minStock;
                const expDays = p.listingExpiresAt ? daysBetween(new Date(), p.listingExpiresAt) : null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-semibold text-slate-900">{p.code}</p>
                      <p className="max-w-[240px] truncate text-xs text-slate-500">{p.name}</p>
                    </Td>
                    <Td>{PROPERTY_TYPE_LABEL[p.type]}</Td>
                    <Td>
                      <p>{p.district ?? "-"}</p>
                      <p className="text-xs text-slate-500">{p.project ?? "-"}</p>
                    </Td>
                    <Td className="text-xs">
                      {numberID(p.landArea)} m²{p.buildingArea > 0 ? ` / ${numberID(p.buildingArea)} m²` : ""}
                      <p className="text-slate-400">{p.certificate ?? "-"}</p>
                    </Td>
                    <Td>
                      <span className={low ? "font-bold text-rose-600" : "font-semibold"}>{p.quantity}</span>
                      <span className="text-xs text-slate-400"> / min {p.minStock}</span>
                      {low ? <div className="mt-1"><Badge tone="red">Stok menipis</Badge></div> : null}
                    </Td>
                    <Td>
                      <p className="font-semibold">{rupiah(p.price)}</p>
                      <p className="text-xs text-slate-400">modal {rupiahShort(p.cost)}</p>
                    </Td>
                    <Td className="text-xs">
                      <p>{formatDate(p.listedAt)}</p>
                      {expDays === null ? (
                        <span className="text-slate-400">tanpa batas</span>
                      ) : expDays < 0 ? (
                        <Badge tone="red">Kadaluarsa {Math.abs(expDays)} hari</Badge>
                      ) : expDays <= 45 ? (
                        <Badge tone="amber">{expDays} hari lagi</Badge>
                      ) : (
                        <span className="text-slate-400">{formatDate(p.listingExpiresAt)}</span>
                      )}
                    </Td>
                    <Td>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[p.status]}`}>
                        {PROPERTY_STATUS_LABEL[p.status]}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {can(role, "inventory.edit") ? (
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Ubah</Button>
                        ) : null}
                        {can(role, "inventory.delete") ? (
                          <Button size="sm" variant="danger" onClick={() => setConfirm(p)}>Hapus</Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="🔍" title="Tidak ada unit yang cocok" desc="Ubah kata kunci atau filter, atau tambahkan unit properti baru." />
        ) : null}
      </Card>

      <Modal
        open={open}
        wide
        onClose={() => setOpen(false)}
        title={editing ? `Ubah Unit ${editing.code}` : "Tambah Unit Properti"}
        desc="Isi detail unit, batas stok minimum, dan masa berlaku listing untuk mendapatkan peringatan otomatis."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Unit"}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kode unit" hint="Kosongkan untuk dibuat otomatis">
            <Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="KVL-PLG-010" />
          </Field>
          <Field label="Nama unit *">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Kavling SHM 120m² Jakabaring" />
          </Field>
          <Field label="Jenis properti">
            <Select value={form.type} onChange={(e) => set("type", e.target.value as PropertyType)}>
              {Object.entries(PROPERTY_TYPE_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as PropertyStatus)}>
              {Object.entries(PROPERTY_STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Nama proyek / perumahan">
            <Input value={form.project} onChange={(e) => set("project", e.target.value)} placeholder="Griya Sukarami Asri" />
          </Field>
          <Field label="Cluster / blok">
            <Input value={form.cluster} onChange={(e) => set("cluster", e.target.value)} placeholder="Cluster Merdeka" />
          </Field>
          <Field label="Kecamatan">
            <Input value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="Sukarami" />
          </Field>
          <Field label="Jenis sertifikat">
            <Select value={form.certificate} onChange={(e) => set("certificate", e.target.value)}>
              <option value="SHM">SHM</option><option value="SHGB">SHGB</option>
              <option value="SHMSRS">SHMSRS</option><option value="AJB">AJB</option>
              <option value="Girik">Girik</option><option value="">Belum ada</option>
            </Select>
          </Field>
          <Field label="Luas tanah (m²)">
            <Input type="number" min={0} value={form.landArea} onChange={(e) => set("landArea", e.target.value)} />
          </Field>
          <Field label="Luas bangunan (m²)">
            <Input type="number" min={0} value={form.buildingArea} onChange={(e) => set("buildingArea", e.target.value)} />
          </Field>
          <Field label="Jumlah unit (stok)">
            <Input type="number" min={0} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Batas stok minimum" hint="Peringatan muncul saat stok ≤ nilai ini">
            <Input type="number" min={0} value={form.minStock} onChange={(e) => set("minStock", e.target.value)} />
          </Field>
          <Field label="Harga jual (Rp)">
            <Input type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="285000000" />
          </Field>
          <Field label="Harga modal (Rp)" hint="Dipakai untuk menghitung potensi pemborosan">
            <Input type="number" min={0} value={form.cost} onChange={(e) => set("cost", e.target.value)} />
          </Field>
          <Field label="Biaya perawatan / bulan (Rp)">
            <Input type="number" min={0} value={form.monthlyFee} onChange={(e) => set("monthlyFee", e.target.value)} />
          </Field>
          <Field label="Alamat lengkap" className="sm:col-span-2">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Jl. Jakabaring Selatan No. 12" />
          </Field>
          <Field label="Tanggal listing mulai">
            <Input type="date" value={form.listedAt} onChange={(e) => set("listedAt", e.target.value)} />
          </Field>
          <Field label="Kadaluarsa listing" hint="Peringatan otomatis 45 hari sebelum tanggal ini">
            <Input type="date" value={form.listingExpiresAt} onChange={(e) => set("listingExpiresAt", e.target.value)} />
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            <TextArea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Sudah siap bangun, akses 6 mobil, dekat pasar" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Hapus unit properti?"
        desc="Tindakan ini juga menghapus transaksi yang terkait dengan unit ini."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>Batal</Button>
            <Button variant="danger" onClick={remove}>Ya, hapus</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Unit <strong>{confirm?.code}</strong> — {confirm?.name} akan dihapus permanen. Semua perubahan
          tercatat pada jejak audit untuk kepatuhan.
        </p>
      </Modal>
    </div>
  );
}
