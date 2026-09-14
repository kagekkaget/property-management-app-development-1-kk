"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/SyncProvider";
import { NAV, ROLE_LABEL, can } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, online, stale, pending, syncing, lastSync, refresh, syncNow } = useApp();
  const [open, setOpen] = useState(false);
  const role = data?.user.role;
  const name = data?.user.name ?? "";

  const items = NAV.filter((item) => can(role, item.action));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-slate-900 text-slate-100 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-lg">🏘️</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight">Kavlingo Palembang</p>
            <p className="truncate text-[10px] text-slate-400">Pemasaran &amp; Penjualan Properti</p>
          </div>
        </div>

        <nav className="space-y-1 p-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-emerald-500 text-white shadow" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="truncate text-sm font-semibold">{name || "Memuat…"}</p>
            <p className="text-[11px] text-emerald-300">{role ? ROLE_LABEL[role] : ""}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-rose-500/80"
            >
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 lg:hidden"
            aria-label="Buka menu"
          >
            ☰
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900">
              {items.find((i) => pathname === i.href)?.label ?? "Kavlingo Palembang"}
            </p>
            <p className="text-[11px] text-slate-500">
              {online ? "Terhubung" : "Mode offline"} · Sinkron terakhir {formatDateTime(lastSync)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                online
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
              {online ? "Online" : "Offline"}
            </span>
            {stale ? (
              <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:inline">
                Data cache
              </span>
            ) : null}
            {pending > 0 ? (
              <button
                type="button"
                onClick={() => void syncNow()}
                className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900"
              >
                {syncing ? "Sinkronisasi…" : `${pending} menunggu sinkron`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              title="Muat ulang data"
            >
              ⟳
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
