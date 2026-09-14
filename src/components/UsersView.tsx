"use client";

import { useState } from "react";
import { useApp } from "@/components/SyncProvider";
import {
  Badge, Button, Card, CardHead, EmptyState, Field, Input, Modal, Select, Td, Th,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";

const PERMISSIONS: { label: string; roles: Role[] }[] = [
  { label: "Lihat dasbor & peringatan", roles: ["owner", "manager", "staff"] },
  { label: "Tambah / ubah unit properti", roles: ["owner", "manager", "staff"] },
  { label: "Hapus unit properti", roles: ["owner", "manager"] },
  { label: "Kelola pelanggan & transaksi", roles: ["owner", "manager", "staff"] },
  { label: "Hapus pelanggan / transaksi", roles: ["owner", "manager"] },
  { label: "Ekspor laporan PDF & CSV", roles: ["owner", "manager"] },
  { label: "Lihat jejak audit", roles: ["owner", "manager"] },
  { label: "Kelola pengguna & peran", roles: ["owner"] },
];

type Form = { name: string; email: string; phone: string; role: Role; password: string };

export function UsersView() {
  const { data, notify, refresh } = useApp();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>({ name: "", email: "", phone: "", role: "staff", password: "" });
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const users = data?.users ?? [];
  const me = data?.user;

  function openCreate() {
    setEditingId(null);
    setError(null);
    setForm({ name: "", email: "", phone: "", role: "staff", password: "" });
    setOpen(true);
  }

  function openEdit(id: number) {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    setEditingId(id);
    setError(null);
    setForm({ name: u.name, email: u.email, phone: u.phone ?? "", role: u.role, password: "" });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(editingId ? "/api/users" : "/api/users", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Gagal menyimpan pengguna");
      return;
    }
    setOpen(false);
    notify(editingId ? "Data pengguna diperbarui" : "Pengguna baru dibuat", "ok");
    await refresh(true);
  }

  async function remove() {
    if (!confirmId) return;
    setBusy(true);
    const res = await fetch(`/api/users?id=${confirmId}`, { method: "DELETE" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setConfirmId(null);
    if (!res.ok) {
      notify(json.error ?? "Gagal menghapus pengguna", "err");
      return;
    }
    notify("Pengguna dihapus", "ok");
    await refresh(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          title="Pengguna & Peran Akses"
          desc="Kelola akun tim dengan pembagian peran: pemilik, manajer, dan staf marketing"
          action={<Button onClick={openCreate}>+ Tambah Pengguna</Button>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead className="bg-slate-50">
              <tr><Th>Nama</Th><Th>Email</Th><Th>Peran</Th><Th>Status</Th><Th>Login Terakhir</Th><Th className="text-right">Aksi</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-semibold text-slate-900">{u.name}</p>
                    {u.id === me?.id ? <p className="text-[11px] text-emerald-600">Akun Anda</p> : null}
                  </Td>
                  <Td className="text-xs">{u.email}</Td>
                  <Td><Badge tone={u.role === "owner" ? "violet" : u.role === "manager" ? "blue" : "slate"}>{ROLE_LABEL[u.role]}</Badge></Td>
                  <Td>{u.isActive ? <Badge tone="green">Aktif</Badge> : <Badge tone="red">Nonaktif</Badge>}</Td>
                  <Td className="text-xs">{formatDateTime(u.lastLoginAt)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(u.id)}>Ubah</Button>
                      {u.id !== me?.id ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirmId(u.id)}>Hapus</Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 ? <EmptyState icon="🛡️" title="Belum ada pengguna" /> : null}
      </Card>

      <Card>
        <CardHead title="Matriks Hak Akses" desc="Ringkasan kewenangan tiap peran dalam sistem" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead className="bg-slate-50">
              <tr><Th>Kemampuan</Th><Th>Pemilik</Th><Th>Manajer</Th><Th>Staf</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERMISSIONS.map((p) => (
                <tr key={p.label}>
                  <Td>{p.label}</Td>
                  {(["owner", "manager", "staff"] as Role[]).map((r) => (
                    <Td key={r}>{p.roles.includes(r) ? "✅" : "—"}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Ubah Pengguna" : "Tambah Pengguna"}
        desc="Kata sandi disimpan sebagai hash scrypt bersalt — tidak pernah dikirim kembali ke klien."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama lengkap">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" hint={editingId ? "Email tidak dapat diubah" : "Dipakai untuk masuk"}>
            <Input type="email" value={form.email} disabled={!!editingId} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Nomor telepon">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Peran">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="owner">Pemilik</option>
              <option value="manager">Manajer</option>
              <option value="staff">Staf Marketing</option>
            </Select>
          </Field>
          <Field label={editingId ? "Kata sandi baru (opsional)" : "Kata sandi"} className="sm:col-span-2" hint="Minimal 6 karakter">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
          </Field>
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 sm:col-span-2">{error}</div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Hapus pengguna?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmId(null)}>Batal</Button>
            <Button variant="danger" onClick={remove} disabled={busy}>Ya, hapus</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Akun akan dihapus dan tidak dapat digunakan untuk masuk lagi.</p>
      </Modal>
    </div>
  );
}
