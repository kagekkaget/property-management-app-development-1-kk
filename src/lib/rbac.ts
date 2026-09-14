export type Role = "owner" | "manager" | "staff";

export type Action =
  | "dashboard.view"
  | "inventory.view"
  | "inventory.edit"
  | "inventory.delete"
  | "customer.view"
  | "customer.edit"
  | "customer.delete"
  | "order.view"
  | "order.edit"
  | "order.delete"
  | "report.view"
  | "report.export"
  | "user.manage"
  | "audit.view";

const MATRIX: Record<Role, Action[]> = {
  owner: [
    "dashboard.view",
    "inventory.view",
    "inventory.edit",
    "inventory.delete",
    "customer.view",
    "customer.edit",
    "customer.delete",
    "order.view",
    "order.edit",
    "order.delete",
    "report.view",
    "report.export",
    "user.manage",
    "audit.view",
  ],
  manager: [
    "dashboard.view",
    "inventory.view",
    "inventory.edit",
    "inventory.delete",
    "customer.view",
    "customer.edit",
    "customer.delete",
    "order.view",
    "order.edit",
    "report.view",
    "report.export",
    "audit.view",
  ],
  staff: [
    "dashboard.view",
    "inventory.view",
    "inventory.edit",
    "customer.view",
    "customer.edit",
    "order.view",
    "order.edit",
    "report.view",
  ],
};

export function can(role: Role | undefined | null, action: Action): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(action) ?? false;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Pemilik",
  manager: "Manajer",
  staff: "Staf Marketing",
};

export const NAV: { href: string; label: string; icon: string; action: Action }[] = [
  { href: "/dashboard", label: "Dasbor", icon: "📊", action: "dashboard.view" },
  { href: "/inventaris", label: "Inventaris Properti", icon: "🏘️", action: "inventory.view" },
  { href: "/pelanggan", label: "Pelanggan", icon: "👥", action: "customer.view" },
  { href: "/pesanan", label: "Transaksi & Pembayaran", icon: "🧾", action: "order.view" },
  { href: "/laporan", label: "Laporan & Ekspor", icon: "📈", action: "report.view" },
  { href: "/pengguna", label: "Pengguna & Peran", icon: "🛡️", action: "user.manage" },
  { href: "/kepatuhan", label: "Kepatuhan & Cadangan", icon: "🔒", action: "dashboard.view" },
];
