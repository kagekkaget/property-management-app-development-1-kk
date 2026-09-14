import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* ==========================================================================
 * Kavlingo Palembang — Skema Database
 * Manajemen Pemasaran & Penjualan Properti (kavling, rumah, ruko, tanah)
 * ========================================================================== */

export const userRoleEnum = pgEnum("user_role", ["owner", "manager", "staff"]);

export const propertyTypeEnum = pgEnum("property_type", [
  "kavling",
  "rumah",
  "ruko",
  "apartemen",
  "tanah",
  "gudang",
]);

export const propertyStatusEnum = pgEnum("property_status", [
  "tersedia",
  "booking",
  "terjual",
  "tertahan",
  "nonaktif",
]);

export const orderTypeEnum = pgEnum("order_type", ["cash", "kpr", "bertahap", "sewa"]);

export const orderStatusEnum = pgEnum("order_status", [
  "menunggu",
  "diproses",
  "selesai",
  "dibatalkan",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "belum_bayar",
  "dp",
  "cicilan",
  "lunas",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "walk_in",
  "whatsapp",
  "instagram",
  "facebook",
  "referensi",
  "agen",
  "website",
  "lainnya",
]);

/* ---------------------------------- Users --------------------------------- */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("staff"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    token: varchar("token", { length: 128 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: varchar("user_agent", { length: 250 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

/* ------------------------- Inventaris / Stok Properti --------------------- */

export const properties = pgTable(
  "properties",
  {
    id: serial("id").primaryKey(),
    clientRef: varchar("client_ref", { length: 64 }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    type: propertyTypeEnum("type").notNull().default("kavling"),
    status: propertyStatusEnum("status").notNull().default("tersedia"),
    project: varchar("project", { length: 160 }),
    cluster: varchar("cluster", { length: 120 }),
    address: text("address"),
    district: varchar("district", { length: 120 }),
    city: varchar("city", { length: 120 }).notNull().default("Palembang"),
    certificate: varchar("certificate", { length: 40 }),
    landArea: integer("land_area").notNull().default(0),
    buildingArea: integer("building_area").notNull().default(0),
    quantity: integer("quantity").notNull().default(1),
    minStock: integer("min_stock").notNull().default(1),
    price: bigint("price", { mode: "number" }).notNull().default(0),
    cost: bigint("cost", { mode: "number" }).notNull().default(0),
    monthlyFee: bigint("monthly_fee", { mode: "number" }).notNull().default(0),
    listedAt: date("listed_at"),
    listingExpiresAt: date("listing_expires_at"),
    agentId: integer("agent_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("properties_code_unique").on(table.code),
    uniqueIndex("properties_client_ref_unique").on(table.clientRef),
    index("properties_status_idx").on(table.status),
  ],
);

/* -------------------------------- Pelanggan ------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    clientRef: varchar("client_ref", { length: 64 }),
    name: varchar("name", { length: 150 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    email: varchar("email", { length: 180 }),
    address: text("address"),
    nik: varchar("nik", { length: 32 }),
    source: leadSourceEnum("source").notNull().default("walk_in"),
    preferredType: propertyTypeEnum("preferred_type"),
    preferredLocation: varchar("preferred_location", { length: 160 }),
    budgetMin: bigint("budget_min", { mode: "number" }).notNull().default(0),
    budgetMax: bigint("budget_max", { mode: "number" }).notNull().default(0),
    preferenceNotes: text("preference_notes"),
    consentPdp: boolean("consent_pdp").notNull().default(false),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    agentId: integer("agent_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_client_ref_unique").on(table.clientRef),
    index("customers_name_idx").on(table.name),
  ],
);

/* -------------------------- Pesanan / Transaksi --------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    clientRef: varchar("client_ref", { length: 64 }),
    code: varchar("code", { length: 40 }).notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    agentId: integer("agent_id").references(() => users.id, { onDelete: "set null" }),
    orderType: orderTypeEnum("order_type").notNull().default("cash"),
    status: orderStatusEnum("status").notNull().default("menunggu"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("belum_bayar"),
    quantity: integer("quantity").notNull().default(1),
    totalPrice: bigint("total_price", { mode: "number" }).notNull().default(0),
    paidAmount: bigint("paid_amount", { mode: "number" }).notNull().default(0),
    orderDate: date("order_date").notNull(),
    nextPaymentDue: date("next_payment_due"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_code_unique").on(table.code),
    uniqueIndex("orders_client_ref_unique").on(table.clientRef),
    index("orders_customer_idx").on(table.customerId),
    index("orders_property_idx").on(table.propertyId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull().default(0),
    method: varchar("method", { length: 40 }).notNull().default("transfer"),
    paidAt: date("paid_at").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payments_order_idx").on(table.orderId)],
);

/* ------------------- Audit trail (kepatuhan UU PDP No. 27/2022) ----------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: varchar("user_name", { length: 120 }),
    action: varchar("action", { length: 60 }).notNull(),
    entity: varchar("entity", { length: 60 }).notNull(),
    entityId: varchar("entity_id", { length: 60 }),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_created_idx").on(table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
