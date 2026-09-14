"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SyncOp } from "@/lib/mutations";

export type AppData = {
  user: { id: number; name: string; email: string; role: "owner" | "manager" | "staff" };
  properties: import("@/lib/types").PropertyDTO[];
  customers: import("@/lib/types").CustomerDTO[];
  orders: import("@/lib/types").OrderDTO[];
  users: import("@/lib/types").UserDTO[];
  audit: {
    id: number;
    userName: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    detail: string | null;
    createdAt: string;
  }[];
  dashboard: import("@/lib/types").DashboardData;
  fetchedAt: string;
};

type QueuedOp = SyncOp & { queuedAt: string };

const CACHE_KEY = "kavlingo:data:v3";
const OUTBOX_KEY = "kavlingo:outbox:v3";

type Ctx = {
  data: AppData | null;
  loading: boolean;
  stale: boolean;
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSync: string | null;
  toast: { text: string; tone: "ok" | "warn" | "err" } | null;
  refresh: (silent?: boolean) => Promise<void>;
  mutate: (op: SyncOp) => Promise<{ ok: boolean; queued?: boolean; error?: string }>;
  syncNow: () => Promise<void>;
  notify: (text: string, tone?: "ok" | "warn" | "err") => void;
};

const AppContext = createContext<Ctx | null>(null);

function readCache(): AppData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AppData) : null;
  } catch {
    return null;
  }
}

function readOutbox(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(ops: QueuedOp[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
}

export function newRef(): string {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* --------------------- pembaruan lokal (optimistic) ---------------------- */

function applyLocal(data: AppData, op: SyncOp): AppData {
  const next: AppData = { ...data, fetchedAt: data.fetchedAt };
  const p = op.payload ?? {};

  if (op.kind === "property.create") {
    next.properties = [
      ...data.properties,
      {
        id: -Date.now(),
        clientRef: op.clientRef ?? null,
        code: String(p.code ?? "(draft)"),
        name: String(p.name ?? "Unit baru"),
        type: (p.type as never) ?? "kavling",
        status: (p.status as never) ?? "tersedia",
        project: (p.project as string) ?? null,
        cluster: (p.cluster as string) ?? null,
        address: (p.address as string) ?? null,
        district: (p.district as string) ?? null,
        city: (p.city as string) ?? "Palembang",
        certificate: (p.certificate as string) ?? null,
        landArea: Number(p.landArea ?? 0),
        buildingArea: Number(p.buildingArea ?? 0),
        quantity: Number(p.quantity ?? 1),
        minStock: Number(p.minStock ?? 1),
        price: Number(p.price ?? 0),
        cost: Number(p.cost ?? 0),
        monthlyFee: Number(p.monthlyFee ?? 0),
        listedAt: (p.listedAt as string) ?? null,
        listingExpiresAt: (p.listingExpiresAt as string) ?? null,
        agentId: null,
        notes: (p.notes as string) ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  } else if (op.kind === "property.update") {
    next.properties = data.properties.map((row) =>
      row.id === op.id || (op.clientRef && row.clientRef === op.clientRef) ? { ...row, ...p } : row,
    );
  } else if (op.kind === "property.delete") {
    next.properties = data.properties.filter((row) => row.id !== op.id);
  } else if (op.kind === "customer.create") {
    next.customers = [
      ...data.customers,
      {
        id: -Date.now(),
        clientRef: op.clientRef ?? null,
        name: String(p.name ?? "Pelanggan"),
        phone: String(p.phone ?? ""),
        email: (p.email as string) ?? null,
        address: (p.address as string) ?? null,
        nik: (p.nik as string) ?? null,
        source: (p.source as never) ?? "walk_in",
        preferredType: (p.preferredType as never) ?? null,
        preferredLocation: (p.preferredLocation as string) ?? null,
        budgetMin: Number(p.budgetMin ?? 0),
        budgetMax: Number(p.budgetMax ?? 0),
        preferenceNotes: (p.preferenceNotes as string) ?? null,
        consentPdp: p.consentPdp === true,
        consentAt: new Date().toISOString(),
        agentId: null,
        notes: (p.notes as string) ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  } else if (op.kind === "customer.update") {
    next.customers = data.customers.map((row) =>
      row.id === op.id || (op.clientRef && row.clientRef === op.clientRef) ? { ...row, ...p } : row,
    );
  } else if (op.kind === "customer.delete") {
    next.customers = data.customers.filter((row) => row.id !== op.id);
    next.orders = data.orders.filter((row) => row.customerId !== op.id);
  } else if (op.kind === "order.create") {
    const customer = data.customers.find((c) => c.id === Number(p.customerId ?? p.customerRef));
    const property = data.properties.find((c) => c.id === Number(p.propertyId ?? p.propertyRef));
    next.orders = [
      {
        id: -Date.now(),
        clientRef: op.clientRef ?? null,
        code: String(p.code ?? "(draft)"),
        customerId: Number(p.customerId ?? 0),
        propertyId: Number(p.propertyId ?? 0),
        agentId: data.user?.id ?? null,
        orderType: (p.orderType as never) ?? "cash",
        status: (p.status as never) ?? "menunggu",
        paymentStatus: "belum_bayar",
        quantity: Number(p.quantity ?? 1),
        totalPrice: Number(p.totalPrice ?? property?.price ?? 0),
        paidAmount: Number(p.paidAmount ?? 0),
        orderDate: String(p.orderDate ?? new Date().toISOString().slice(0, 10)),
        nextPaymentDue: (p.nextPaymentDue as string) ?? null,
        notes: (p.notes as string) ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customerName: customer?.name,
        propertyCode: property?.code,
        propertyName: property?.name,
        payments: [],
      },
      ...data.orders,
    ];
  } else if (op.kind === "order.update") {
    next.orders = data.orders.map((row) =>
      row.id === op.id || (op.clientRef && row.clientRef === op.clientRef) ? { ...row, ...p } : row,
    );
  } else if (op.kind === "order.delete") {
    next.orders = data.orders.filter((row) => row.id !== op.id);
  } else if (op.kind === "payment.create") {
    next.orders = data.orders.map((row) =>
      row.id === Number(p.orderId)
        ? {
            ...row,
            paidAmount: row.paidAmount + Number(p.amount ?? 0),
            payments: [
              ...(row.payments ?? []),
              {
                id: -Date.now(),
                orderId: row.id,
                amount: Number(p.amount ?? 0),
                method: String(p.method ?? "transfer"),
                paidAt: String(p.paidAt ?? new Date().toISOString().slice(0, 10)),
                note: (p.note as string) ?? null,
              },
            ],
          }
        : row,
    );
  }
  return next;
}

/* ------------------------------- Provider -------------------------------- */

export function SyncProvider({ children }: { children: ReactNode }) {
const [data, setData] = useState<AppData | null>(() => {
  if (typeof window !== "undefined") {
    return readCache();
  }
  return null;
});
const [loading, setLoading] = useState(() => {
  if (typeof window !== "undefined") {
    return readCache() === null;
  }
  return true;
});
const [stale, setStale] = useState(() => {
  if (typeof window !== "undefined") {
    return readCache() !== null;
  }
  return false;
});
const [online, setOnline] = useState(() => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
});
const [pending, setPending] = useState(() => readOutbox().length);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [toast, setToast] = useState<Ctx["toast"]>(null);
  const busy = useRef(false);

  const notify = useCallback((text: string, tone: "ok" | "warn" | "err" = "ok") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (!res.ok) throw new Error("gagal");
      const json = (await res.json()) as AppData;
      setData(json);
      setStale(false);
      setLastSync(new Date().toISOString());
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(json));
    } catch {
      setStale(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    const queue = readOutbox();
    if (queue.length === 0 || busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: queue.map(({ queuedAt: _queuedAt, ...op }) => op) }),
      });
      if (!res.ok && res.status !== 207) throw new Error("gagal");
      const json = (await res.json()) as { results: { ok: boolean; error?: string }[] };
      const failed = json.results?.filter((r) => !r.ok) ?? [];
      writeOutbox([]);
      setPending(0);
      await refresh(true);
      if (failed.length > 0) {
        notify(`${failed.length} perubahan gagal disinkronkan (${failed[0]?.error ?? "error"})`, "warn");
      } else {
        notify(`${queue.length} perubahan offline berhasil disinkronkan`, "ok");
      }
    } catch {
      notify("Masih offline — perubahan disimpan di perangkat", "warn");
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [notify, refresh]);

  const mutate = useCallback(
    async (op: SyncOp): Promise<{ ok: boolean; queued?: boolean; error?: string }> => {
      const prepared: SyncOp = op;
      if (op.kind.endsWith(".create") && !op.clientRef) prepared.clientRef = newRef();
      const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;

      setData((prev) => (prev ? applyLocal(prev, prepared) : prev));

      if (!isOnline) {
        const queue = readOutbox();
        queue.push({ ...prepared, queuedAt: new Date().toISOString() });
        writeOutbox(queue);
        setPending(queue.length);
        notify("Offline — perubahan disimpan & akan disinkronkan otomatis", "warn");
        return { ok: true, queued: true };
      }

      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ops: [prepared] }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          results?: { ok: boolean; error?: string }[];
          error?: string;
        };
        const result = json.results?.[0];
        if (!res.ok && res.status !== 207) {
          if (res.status === 401 || res.status === 403) {
            return { ok: false, error: json.error ?? result?.error ?? "Akses ditolak" };
          }
          throw new Error("offline");
        }
        if (result && !result.ok) return { ok: false, error: result.error ?? "Gagal menyimpan" };
        await refresh(true);
        return { ok: true };
      } catch {
        const queue = readOutbox();
        queue.push({ ...prepared, queuedAt: new Date().toISOString() });
        writeOutbox(queue);
        setPending(queue.length);
        notify("Koneksi terputus — perubahan masuk antrean sinkronisasi", "warn");
        return { ok: true, queued: true };
      }
    },
    [notify, refresh],
  );

  useEffect(() => {
    const cached = readCache();
    requestAnimationFrame(() => {
      void refresh(!cached);
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const goOnline = () => {
      setOnline(true);
      void syncNow();
      void refresh(true);
    };
    const goOffline = () => {
      setOnline(false);
      notify("Mode offline aktif — data terakhir tetap dapat diakses", "warn");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void refresh(true);
    }, 60_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
    };
  }, [notify, refresh, syncNow]);

  useEffect(() => {
    if (online && pending > 0 && !syncing) {
      requestAnimationFrame(() => {
        void syncNow();
      });
    }
  }, [online, pending, syncing, syncNow]);

  const value = useMemo<Ctx>(
    () => ({
      data,
      loading,
      stale,
      online,
      pending,
      syncing,
      lastSync,
      toast,
      refresh,
      mutate,
      syncNow,
      notify,
    }),
    [data, loading, stale, online, pending, syncing, lastSync, toast, refresh, mutate, syncNow, notify],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {toast ? (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-100 -translate-x-1/2 px-4">
          <div
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ${
              toast.tone === "ok"
                ? "bg-emerald-600 text-white ring-emerald-700"
                : toast.tone === "warn"
                  ? "bg-amber-500 text-amber-950 ring-amber-600"
                  : "bg-rose-600 text-white ring-rose-700"
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </AppContext.Provider>
  );
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp harus dipakai di dalam SyncProvider");
  return ctx;
}
