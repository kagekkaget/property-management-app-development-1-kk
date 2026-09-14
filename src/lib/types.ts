export type Role = "owner" | "manager" | "staff";

export type PropertyType = "kavling" | "rumah" | "ruko" | "apartemen" | "tanah" | "gudang";
export type PropertyStatus = "tersedia" | "booking" | "terjual" | "tertahan" | "nonaktif";
export type OrderType = "cash" | "kpr" | "bertahap" | "sewa";
export type OrderStatus = "menunggu" | "diproses" | "selesai" | "dibatalkan";
export type PaymentStatus = "belum_bayar" | "dp" | "cicilan" | "lunas";
export type LeadSource =
  | "walk_in"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "referensi"
  | "agen"
  | "website"
  | "lainnya";

export type PropertyDTO = {
  id: number;
  clientRef: string | null;
  code: string;
  name: string;
  type: PropertyType;
  status: PropertyStatus;
  project: string | null;
  cluster: string | null;
  address: string | null;
  district: string | null;
  city: string;
  certificate: string | null;
  landArea: number;
  buildingArea: number;
  quantity: number;
  minStock: number;
  price: number;
  cost: number;
  monthlyFee: number;
  listedAt: string | null;
  listingExpiresAt: string | null;
  agentId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDTO = {
  id: number;
  clientRef: string | null;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  nik: string | null;
  source: LeadSource;
  preferredType: PropertyType | null;
  preferredLocation: string | null;
  budgetMin: number;
  budgetMax: number;
  preferenceNotes: string | null;
  consentPdp: boolean;
  consentAt: string | null;
  agentId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentDTO = {
  id: number;
  orderId: number;
  amount: number;
  method: string;
  paidAt: string;
  note: string | null;
};

export type OrderDTO = {
  id: number;
  clientRef: string | null;
  code: string;
  customerId: number;
  propertyId: number;
  agentId: number | null;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  quantity: number;
  totalPrice: number;
  paidAmount: number;
  orderDate: string;
  nextPaymentDue: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerPhone?: string;
  propertyCode?: string;
  propertyName?: string;
  agentName?: string | null;
  payments?: PaymentDTO[];
};

export type UserDTO = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AlertItem = {
  id: string;
  level: "kritis" | "peringatan" | "info";
  category: "stok" | "kadaluarsa" | "pembayaran" | "unit_menganggur";
  title: string;
  description: string;
  link: string;
};

export type DashboardData = {
  kpi: {
    totalProperty: number;
    availableUnits: number;
    soldUnits: number;
    bookedUnits: number;
    stockValue: number;
    potentialRevenue: number;
    revenueThisMonth: number;
    revenueTotal: number;
    receivable: number;
    wasteValue: number;
    staleUnits: number;
    customers: number;
    activeOrders: number;
  };
  salesByMonth: { month: string; total: number; count: number }[];
  byType: { type: PropertyType; total: number; value: number; available: number }[];
  byStatus: { status: PropertyStatus; count: number }[];
  topAgents: { name: string; total: number; count: number }[];
  alerts: AlertItem[];
  recentOrders: OrderDTO[];
  staleProperties: PropertyDTO[];
};

export type ReportBundle = {
  generatedAt: string;
  period: { from: string; to: string };
  properties: PropertyDTO[];
  customers: CustomerDTO[];
  orders: OrderDTO[];
  summary: DashboardData;
};
