"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/SyncProvider";
import {
  Badge, Button, Card, CardHead, EmptyState, Field, Input, Modal, Select, StatCard, TextArea, Td, Th,
} from "@/components/ui";
import {
  ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, PAYMENT_STATUS_LABEL, STATUS_TONE,
  formatDate, numberID, rupiah, rupiahShort, todayISO,
} from "@/lib/format";
import { can } from "@/lib/rbac";
import type { OrderDTO, OrderStatus, OrderType } from "@/lib/types";

type Form = {
  customerId: string; propertyId: string; orderType: OrderType; status: OrderStatus;
  quantity: string; totalPrice: string; paidAmount: string; orderDate: string;
  nextPaymentDue: string; paymentMethod: string; notes: string;
};

const emptyForm = (): Form => ({
  customerId: "", propertyId: "", orderType: "cash", status: "menunggu", quantity: "1",
  totalPrice: "", paidAmount: "0", orderDate: todayISO(), nextPaymentDue: "", paymentMethod: "transfer", notes: "",
});

export function OrdersView() {
  const { data, mutate, notify } = useApp();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("semua");
  const [payment, setPayment] = useState("semua");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrderDTO | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [confirm, setConfirm] = useState<OrderDTO | null>(null);
  const [payFor, setPayFor] = useState<OrderDTO | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "transfer", paidAt: todayISO(), note: "" });
  const [saving, setSaving] = useState(false);

  const role = data?.user.role;
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const customers = useMemo(() => data?.customers ?? [], [data]);
  const properties = useMemo(() => data?.properties ?? [], [data]);
  const today = todayISO();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (needle) {
        const hay = `${o.code} ${o.customerName ?? ""} ${o.propertyCode ?? ""} ${o.propertyName ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (status !== "semua" && o.status !== status) return false;
      if (payment !== "semua" && o.paymentStatus !== payment) return false;
      return true;
    });
  }, [orders, q, status, payment]);

  const valid = orders.filter((o) => o.status !== "dibatalkan");
  const totalValue = valid.reduce((s, o) => s + o.totalPrice, 0);
  const totalPaid = valid.reduce((s, o) => s + o.paidAmount, 0);
  const receivable = valid.reduce((s, o) => s + Math.max(o.totalPrice - o.paidAmount, 0), 0);
  const overdue = valid.filter((o) => o.paymentStatus !== "lunas" && o.nextPaymentDue && o.nextPaymentDue < today);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(o: OrderDTO) {
    setEditing(o);
    setForm({
      customerId: String(o.customerId), propertyId: String(o.propertyId), orderType: o.orderType,
      status: o.status, quantity: String(o.quantity), totalPrice: String(o.totalPrice),
      paidAmount: String(o.paidAmount), orderDate: o.orderDate, nextPaymentDue: o.nextPaymentDue ?? "",
      paymentMethod: "transfer", notes: o.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.customerId || !form.propertyId) {
      notify("Pilih pelanggan dan unit properti", "err");
      return;
    }
    setSaving(true);
    const payload = { ...form };
    const res = await mutate(
      editing ? { kind: "order.update", id: editing.id, payload } : { kind: "order.create", payload },
    );
    setSaving(false);
    if (!res.ok) {
      notify(res.error ?? "Gagal menyimpan transaksi", "err");
      return;
    }
    setOpen(false);
    notify(editing ? "Transaksi diperbarui" : "Transaksi baru dibuat", "ok");
  }

  async function remove() {
    if (!confirm) return;
    const res = await mutate({ kind: "order.delete", id: confirm.id });
    setConfirm(null);
    notify(res.ok ? "Transaksi dihapus" : (res.error ?? "Gagal menghapus"), res.ok ? "ok" : "err");
  }

  function openPay(o: OrderDTO) {
    setPayFor(o);
    setPayForm({ amount: String(Math.max(o.totalPrice - o.paidAmount, 0)), method: "transfer", paidAt: todayISO(), note: "" });
  }

  async function submitPayment() {
    if (!payFor) return;
    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Nominal pembayaran tidak valid", "err");
      return;
    }
    setSaving(true);
    const res = await mutate({
      kind: "payment.create",
      payload: { orderId: payFor.id, amount, method: payForm.method, paidAt: payForm.paidAt, note: payForm.note },
    });
    setSaving(false);
    if (!res.ok) {
      notify(res.error ?? "Gagal mencatat pembayaran", "err");
      return;
    }
    setPayFor(null);
    notify("Pembayaran berhasil dicatat", "ok");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Nilai Transaksi" value={rupiahShort(totalValue)} sub={`${numberID(valid.length)} transaksi aktif`} tone="blue" icon="🧾" />
        <StatCard label="Pembayaran Diterima" value={rupiahShort(totalPaid)} sub="Akumulasi seluruh transaksi" tone="green" icon="✅" />
        <StatCard label="Piutang" value={rupiahShort(receivable)} sub="Belum tertagih" tone="amber" icon="⏳" />
        <StatCard label="Jatuh Tempo Terlewat" value={numberID(overdue.length)} sub="Perlu penagihan segera" tone={overdue.length ? "red" : "slate"} icon="🚨" />
      </div>

      <Card>
        <CardHead
          title="Transaksi & Pembayaran"
          desc="Kelola booking, KPR, pembayaran bertahap, dan status pelunasan"
          action={
            <div className="flex flex-wrap gap-2">
              {can(role, "report.export") ? (
                <a href="/api/export?type=penjualan" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  ⬇ Ekspor CSV
                </a>
              ) : null}
              {can(role, "order.edit") ? <Button onClick={openCreate}>+ Transaksi Baru</Button> : null}
            </div>
          }
        />

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 md:grid-cols-3">
          <Field label="Cari">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kode, pelanggan, unit" />
          </Field>
          <Field label="Status transaksi">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="semua">Semua status</option>
              {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Status pembayaran">
            <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="semua">Semua pembayaran</option>
              {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-slate-50">
              <tr>
                <Th>Kode / Tanggal</Th><Th>Pelanggan</Th><Th>Unit</Th><Th>Skema</Th><Th>Nilai</Th>
                <Th>Dibayar / Sisa</Th><Th>Jatuh Tempo</Th><Th>Status</Th><Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => {
                const outstanding = Math.max(o.totalPrice - o.paidAmount, 0);
                const late = o.paymentStatus !== "lunas" && o.nextPaymentDue && o.nextPaymentDue < today;
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-semibold text-slate-900">{o.code}</p>
                      <p className="text-xs text-slate-500">{formatDate(o.orderDate)}</p>
                    </Td>
                    <Td>
                      <p className="font-medium">{o.customerName ?? "-"}</p>
                      <p className="text-xs text-slate-500">{o.customerPhone ?? ""}</p>
                    </Td>
                    <Td>
                      <p className="text-xs font-semibold text-slate-700">{o.propertyCode}</p>
                      <p className="max-w-[200px] truncate text-xs text-slate-500">{o.propertyName ?? "-"}</p>
                    </Td>
                    <Td className="text-xs">{ORDER_TYPE_LABEL[o.orderType]}</Td>
                    <Td>
                      <p className="font-semibold">{rupiah(o.totalPrice)}</p>
                      <p className="text-xs text-slate-400">{o.quantity} unit</p>
                    </Td>
                    <Td>
                      <p className="text-xs font-semibold text-emerald-700">{rupiahShort(o.paidAmount)}</p>
                      <p className={outstanding > 0 ? "text-xs font-semibold text-rose-600" : "text-xs text-slate-400"}>sisa {rupiahShort(outstanding)}</p>
                      <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (o.paidAmount / Math.max(o.totalPrice, 1)) * 100)}%` }} />
                      </div>
                    </Td>
                    <Td className="text-xs">
                      {o.nextPaymentDue ? (late ? <Badge tone="red">{formatDate(o.nextPaymentDue)}</Badge> : formatDate(o.nextPaymentDue)) : <span className="text-slate-400">-</span>}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                        <span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[o.paymentStatus]}`}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</span>
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {can(role, "order.edit") && o.paymentStatus !== "lunas" ? (
                          <Button size="sm" variant="soft" onClick={() => openPay(o)}>Bayar</Button>
                        ) : null}
                        {can(role, "order.edit") ? <Button size="sm" variant="outline" onClick={() => openEdit(o)}>Ubah</Button> : null}
                        {can(role, "order.delete") ? <Button size="sm" variant="danger" onClick={() => setConfirm(o)}>Hapus</Button> : null}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <EmptyState icon="🧾" title="Belum ada transaksi" desc="Buat transaksi baru untuk mencatat booking atau penjualan unit." /> : null}
      </Card>

      <Modal
        open={open}
        wide
        onClose={() => setOpen(false)}
        title={editing ? `Ubah Transaksi ${editing.code}` : "Buat Transaksi Baru"}
        desc="Transaksi baru otomatis menandai unit sebagai booking dan mengurangi stok."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Transaksi"}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pelanggan *">
            <Select value={form.customerId} onChange={(e) => set("customerId", e.target.value)}>
              <option value="">Pilih pelanggan</option>
              {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} — {c.phone}</option>))}
            </Select>
          </Field>
          <Field label="Unit properti *">
            <Select value={form.propertyId} onChange={(e) => set("propertyId", e.target.value)}>
              <option value="">Pilih unit</option>
              {properties.map((p) => (<option key={p.id} value={p.id}>{p.code} — {p.name} ({rupiahShort(p.price)})</option>))}
            </Select>
          </Field>
          <Field label="Skema pembayaran">
            <Select value={form.orderType} onChange={(e) => set("orderType", e.target.value as OrderType)}>
              {Object.entries(ORDER_TYPE_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Status transaksi" hint="Status selesai menandai unit sebagai terjual">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as OrderStatus)}>
              {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Select>
          </Field>
          <Field label="Jumlah unit">
            <Input type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Nilai transaksi (Rp)">
            <Input type="number" min={0} value={form.totalPrice} onChange={(e) => set("totalPrice", e.target.value)} placeholder="285000000" />
          </Field>
          <Field label="Sudah dibayar (Rp)">
            <Input type="number" min={0} value={form.paidAmount} onChange={(e) => set("paidAmount", e.target.value)} />
          </Field>
          <Field label="Metode pembayaran awal">
            <Select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
              <option value="transfer">Transfer bank</option>
              <option value="tunai">Tunai</option>
              <option value="kpr">KPR bank</option>
              <option value="cicilan">Cicilan developer</option>
              <option value="qris">QRIS</option>
            </Select>
          </Field>
          <Field label="Tanggal transaksi">
            <Input type="date" value={form.orderDate} onChange={(e) => set("orderDate", e.target.value)} />
          </Field>
          <Field label="Jatuh tempo berikutnya" hint="Peringatan otomatis bila tanggal terlewat">
            <Input type="date" value={form.nextPaymentDue} onChange={(e) => set("nextPaymentDue", e.target.value)} />
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            <TextArea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Proses KPR Bank Sumsel Babel, akad bulan depan" />
          </Field>
        </div>

        {editing && editing.payments && editing.payments.length > 0 ? (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Riwayat pembayaran</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr><Th>Tanggal</Th><Th>Metode</Th><Th>Nominal</Th><Th>Catatan</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editing.payments.map((p) => (
                    <tr key={p.id}>
                      <Td>{formatDate(p.paidAt)}</Td>
                      <Td className="capitalize">{p.method}</Td>
                      <Td className="font-semibold">{rupiah(p.amount)}</Td>
                      <Td className="text-xs text-slate-500">{p.note ?? "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!payFor}
        onClose={() => setPayFor(null)}
        title={`Catat Pembayaran — ${payFor?.code ?? ""}`}
        desc="Status pembayaran diperbarui otomatis (DP / cicilan / lunas)."
        footer={
          <>
            <Button variant="outline" onClick={() => setPayFor(null)}>Batal</Button>
            <Button onClick={submitPayment} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Pembayaran"}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3 text-xs sm:col-span-2">
            <p className="font-semibold text-slate-800">{payFor?.customerName}</p>
            <p className="text-slate-500">Total {rupiah(payFor?.totalPrice ?? 0)} · dibayar {rupiah(payFor?.paidAmount ?? 0)}</p>
            <p className="font-semibold text-rose-600">
              Sisa {rupiah(Math.max((payFor?.totalPrice ?? 0) - (payFor?.paidAmount ?? 0), 0))}
            </p>
          </div>
          <Field label="Nominal pembayaran (Rp)">
            <Input type="number" min={0} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </Field>
          <Field label="Metode">
            <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="transfer">Transfer bank</option>
              <option value="tunai">Tunai</option>
              <option value="kpr">KPR bank</option>
              <option value="cicilan">Cicilan developer</option>
              <option value="qris">QRIS</option>
            </Select>
          </Field>
          <Field label="Tanggal pembayaran">
            <Input type="date" value={payForm.paidAt} onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })} />
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            <Input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} placeholder="DP 20% via transfer" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Hapus transaksi?"
        desc="Unit terkait akan dikembalikan ke status tersedia."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>Batal</Button>
            <Button variant="danger" onClick={remove}>Ya, hapus</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Transaksi <strong>{confirm?.code}</strong> untuk {confirm?.customerName} akan dihapus permanen.
        </p>
      </Modal>
    </div>
  );
}
