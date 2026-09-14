import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, customers, orders, payments, properties, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function ts(offsetDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}

let seedPromise: Promise<void> | null = null;
let seedRetryCount = 0;
const MAX_SEED_RETRIES = 3;

/** Menyiapkan data awal (idempoten) — dipanggil saat request pertama. */
export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedWithRetry().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

async function seedWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_SEED_RETRIES; attempt++) {
    try {
      await seed();
      return;
    } catch (error) {
      seedRetryCount++;
      if (attempt >= MAX_SEED_RETRIES) throw error;
      const delay = Math.min(1000 * 2 ** attempt, 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function seed(): Promise<void> {
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if ((existing[0]?.count ?? 0) > 0) return;

  const insertedUsers = await db
    .insert(users)
    .values([
      {
        name: "H. Bambang Wijaya",
        email: "owner@kavlingo.id",
        phone: "0811 7000 100",
        passwordHash: hashPassword("owner123"),
        role: "owner",
      },
      {
        name: "Siti Rahmawati",
        email: "manager@kavlingo.id",
        phone: "0812 7000 200",
        passwordHash: hashPassword("manager123"),
        role: "manager",
      },
      {
        name: "Rizky Pratama",
        email: "staff@kavlingo.id",
        phone: "0813 7000 300",
        passwordHash: hashPassword("staff123"),
        role: "staff",
      },
      {
        name: "Dewi Lestari",
        email: "dewi@kavlingo.id",
        phone: "0857 7000 400",
        passwordHash: hashPassword("staff123"),
        role: "staff",
      },
    ])
    .returning({ id: users.id, role: users.role });

  const ownerId = insertedUsers[0]!.id;
  const managerId = insertedUsers[1]!.id;
  const staff1 = insertedUsers[2]!.id;
  const staff2 = insertedUsers[3]!.id;

  const propertySeed = [
    {
      code: "KVL-PLG-001",
      name: "Kavling SHM 120m² Jakabaring",
      type: "kavling" as const,
      project: "Perumahan Jakabaring Sentosa",
      cluster: "Cluster Merdeka",
      district: "Jakabaring",
      landArea: 120,
      quantity: 4,
      minStock: 2,
      price: 285_000_000,
      cost: 225_000_000,
      listedAt: isoDate(-150),
      listingExpiresAt: isoDate(28),
      agentId: staff1,
      address: "Jl. Jakabaring Selatan No. 12, Jakabaring",
      certificate: "SHM",
    },
    {
      code: "KVL-PLG-002",
      name: "Kavling Siap Bangun 200m² Sukarami",
      type: "kavling" as const,
      project: "Griya Sukarami Asri",
      cluster: "Cluster Anggrek",
      district: "Sukarami",
      landArea: 200,
      quantity: 1,
      minStock: 2,
      price: 420_000_000,
      cost: 350_000_000,
      listedAt: isoDate(-210),
      listingExpiresAt: isoDate(-12),
      agentId: staff2,
      address: "Jl. Merpati Raya, Sukarami",
      certificate: "SHM",
    },
    {
      code: "KVL-PLG-003",
      name: "Kavling Sudut 150m² Bukit Lama",
      type: "kavling" as const,
      project: "Bukit Lama Residence",
      cluster: "Cluster Kenanga",
      district: "Ilir Barat I",
      landArea: 150,
      quantity: 6,
      minStock: 2,
      price: 360_000_000,
      cost: 290_000_000,
      listedAt: isoDate(-70),
      listingExpiresAt: isoDate(120),
      agentId: managerId,
      address: "Jl. Bukit Lama Indah, Ilir Barat I",
      certificate: "SHM",
    },
    {
      code: "RMH-PLG-001",
      name: "Rumah 2 Lantai 45/90 Sako",
      type: "rumah" as const,
      project: "Grand Sako Permai",
      cluster: "Cluster Melati",
      district: "Sako",
      landArea: 90,
      buildingArea: 120,
      quantity: 2,
      minStock: 1,
      price: 780_000_000,
      cost: 640_000_000,
      listedAt: isoDate(-95),
      listingExpiresAt: isoDate(40),
      agentId: staff1,
      address: "Jl. Sako Kencana, Sako",
      certificate: "SHM",
    },
    {
      code: "RMH-PLG-002",
      name: "Rumah Subsidi 36/60 Sematang",
      type: "rumah" as const,
      project: "Sematang Borang Indah",
      cluster: "Cluster Dahlia",
      district: "Sematang Borang",
      landArea: 60,
      buildingArea: 36,
      quantity: 8,
      minStock: 3,
      price: 245_000_000,
      cost: 198_000_000,
      listedAt: isoDate(-35),
      listingExpiresAt: isoDate(210),
      agentId: staff2,
      address: "Jl. Bumi Serdang, Sematang Borang",
      certificate: "SHGB",
    },
    {
      code: "RKO-PLG-001",
      name: "Ruko 3 Lantai 16 Km5",
      type: "ruko" as const,
      project: "Ruko Palembang Square",
      cluster: null,
      district: "Ilir Timur II",
      landArea: 80,
      buildingArea: 240,
      quantity: 1,
      minStock: 1,
      price: 1_650_000_000,
      cost: 1_380_000_000,
      listedAt: isoDate(-190),
      listingExpiresAt: isoDate(-5),
      agentId: managerId,
      address: "Jl. Soekarno Hatta KM5, Ilir Timur II",
      certificate: "SHM",
    },
    {
      code: "TNH-PLG-001",
      name: "Tanah Kavling 500m² Talang Kelapa",
      type: "tanah" as const,
      project: "Talang Kelapa Estate",
      cluster: null,
      district: "Talang Kelapa",
      landArea: 500,
      quantity: 3,
      minStock: 1,
      price: 525_000_000,
      cost: 420_000_000,
      listedAt: isoDate(-250),
      listingExpiresAt: isoDate(15),
      agentId: staff1,
      address: "Jl. Talang Kelapa Utama, Talang Kelapa",
      certificate: "SHM",
    },
    {
      code: "APR-PLG-001",
      name: "Apartemen 2BR 48m² Benteng",
      type: "apartemen" as const,
      project: "Benteng City Apartment",
      cluster: "Tower A",
      district: "Seberang Ulu I",
      buildingArea: 48,
      quantity: 5,
      minStock: 2,
      price: 430_000_000,
      cost: 360_000_000,
      listedAt: isoDate(-55),
      listingExpiresAt: isoDate(75),
      agentId: staff2,
      address: "Jl. Benteng Timur, Seberang Ulu I",
      certificate: "SHMSRS",
    },
    {
      code: "GDG-PLG-001",
      name: "Gudang 600m² Charitas",
      type: "gudang" as const,
      project: "Charitas Logistic Park",
      cluster: null,
      district: "Ilir Barat I",
      landArea: 600,
      buildingArea: 480,
      quantity: 1,
      minStock: 1,
      price: 2_100_000_000,
      cost: 1_750_000_000,
      listedAt: isoDate(-300),
      listingExpiresAt: isoDate(60),
      agentId: managerId,
      address: "Jl. Charitas Indah, Ilir Barat I",
      certificate: "SHM",
    },
    {
      code: "KVL-PLG-004",
      name: "Kavling 100m² Plaju Indah",
      type: "kavling" as const,
      project: "Plaju Karya",
      cluster: "Cluster Mawar",
      district: "Plaju",
      landArea: 100,
      quantity: 7,
      minStock: 2,
      price: 215_000_000,
      cost: 168_000_000,
      listedAt: isoDate(-20),
      listingExpiresAt: isoDate(240),
      agentId: staff1,
      address: "Jl. Mayor Ali Kecil, Plaju",
      certificate: "SHM",
    },
  ];

  const insertedProps = await db
    .insert(properties)
    .values(propertySeed.map((p) => ({ ...p, city: "Palembang", status: "tersedia" as const })))
    .returning({ id: properties.id, code: properties.code, price: properties.price });
  const propByCode = new Map(insertedProps.map((p) => [p.code, p]));

  const customerSeed = [
    {
      name: "Ahmad Fauzi",
      phone: "0812 3456 7801",
      email: "ahmad.fauzi@mail.com",
      address: "Jl. Rajawali No. 8, Palembang",
      nik: "1671020101850001",
      source: "whatsapp" as const,
      preferredType: "kavling" as const,
      preferredLocation: "Jakabaring / Seberang Ulu",
      budgetMin: 200_000_000,
      budgetMax: 400_000_000,
      preferenceNotes: "Butuh kavling siap bangun, preferensi SHM dan lebar muka minimal 8m.",
      consentPdp: true,
      consentAt: ts(-40),
      agentId: staff1,
    },
    {
      name: "Rina Andriani",
      phone: "0813 8899 2210",
      email: "rina.andriani@mail.com",
      address: "Jl. Angkasa 3, Sako, Palembang",
      nik: "1671045505900002",
      source: "instagram" as const,
      preferredType: "rumah" as const,
      preferredLocation: "Sako / Ilir Barat",
      budgetMin: 500_000_000,
      budgetMax: 900_000_000,
      preferenceNotes: "Rumah siap huni 2 lantai, dekat sekolah internasional.",
      consentPdp: true,
      consentAt: ts(-28),
      agentId: staff2,
    },
    {
      name: "Hendra Gunawan",
      phone: "0811 2233 4455",
      email: "hendra.g@mail.com",
      address: "Jl. Dempo Luar, Palembang",
      source: "referensi" as const,
      preferredType: "ruko" as const,
      preferredLocation: "Soekarno Hatta KM3-KM7",
      budgetMin: 1_200_000_000,
      budgetMax: 2_000_000_000,
      preferenceNotes: "Untuk investasi usaha, butuh ruko parkir luas.",
      consentPdp: false,
      agentId: managerId,
    },
    {
      name: "Siti Aminah",
      phone: "0852 6677 8899",
      email: null,
      address: "Jl. Kolonel Atmo, Palembang",
      source: "walk_in" as const,
      preferredType: "rumah" as const,
      preferredLocation: "Sematang Borang",
      budgetMin: 200_000_000,
      budgetMax: 300_000_000,
      preferenceNotes: "Pencari rumah subsidi / KPR FLPP.",
      consentPdp: true,
      consentAt: ts(-12),
      agentId: staff1,
    },
    {
      name: "Budi Santoso",
      phone: "0821 5566 7788",
      email: "budi.santoso@mail.com",
      address: "Jl. Demang Lebar Daun, Palembang",
      source: "agen" as const,
      preferredType: "tanah" as const,
      preferredLocation: "Talang Kelapa",
      budgetMin: 400_000_000,
      budgetMax: 700_000_000,
      preferenceNotes: "Investasi tanah, target 500m² dengan akses truk.",
      consentPdp: true,
      consentAt: ts(-60),
      agentId: staff2,
    },
    {
      name: "Maya Puspita",
      phone: "0812 9988 7766",
      email: "maya.puspita@mail.com",
      address: "Jl. Sudirman, Palembang",
      source: "website" as const,
      preferredType: "apartemen" as const,
      preferredLocation: "Benteng / pusat kota",
      budgetMin: 350_000_000,
      budgetMax: 500_000_000,
      preferenceNotes: "Unit lantai tinggi menghadap Musi.",
      consentPdp: true,
      consentAt: ts(-8),
      agentId: staff1,
    },
    {
      name: "Ir. Slamet Riyadi",
      phone: "0815 3344 5566",
      email: "slamet.riyadi@mail.com",
      address: "Jl. Radial, Palembang",
      source: "referensi" as const,
      preferredType: "gudang" as const,
      preferredLocation: "Charitas / Ilir Barat",
      budgetMin: 1_800_000_000,
      budgetMax: 2_500_000_000,
      preferenceNotes: "Untuk logistik, butuh listrik besar dan halaman kontainer.",
      consentPdp: true,
      consentAt: ts(-90),
      agentId: managerId,
    },
  ];

  const insertedCustomers = await db
    .insert(customers)
    .values(customerSeed)
    .returning({ id: customers.id, name: customers.name });
  const custByName = new Map(insertedCustomers.map((c) => [c.name, c.id]));

  const orderSeed = [
    {
      code: "TRX-2025-0001",
      customer: "Ahmad Fauzi",
      property: "KVL-PLG-001",
      agentId: staff1,
      orderType: "bertahap" as const,
      status: "selesai" as const,
      paymentStatus: "lunas" as const,
      orderDate: isoDate(-120),
      paid: 285_000_000,
      next: null,
    },
    {
      code: "TRX-2025-0002",
      customer: "Rina Andriani",
      property: "RMH-PLG-001",
      agentId: staff2,
      orderType: "kpr" as const,
      status: "diproses" as const,
      paymentStatus: "dp" as const,
      orderDate: isoDate(-45),
      paid: 156_000_000,
      next: isoDate(-3),
    },
    {
      code: "TRX-2025-0003",
      customer: "Siti Aminah",
      property: "RMH-PLG-002",
      agentId: staff1,
      orderType: "kpr" as const,
      status: "diproses" as const,
      paymentStatus: "cicilan" as const,
      orderDate: isoDate(-70),
      paid: 60_000_000,
      next: isoDate(-15),
    },
    {
      code: "TRX-2025-0004",
      customer: "Budi Santoso",
      property: "TNH-PLG-001",
      agentId: staff2,
      orderType: "cash" as const,
      status: "selesai" as const,
      paymentStatus: "lunas" as const,
      orderDate: isoDate(-25),
      paid: 525_000_000,
      next: null,
    },
    {
      code: "TRX-2026-0001",
      customer: "Maya Puspita",
      property: "APR-PLG-001",
      agentId: staff1,
      orderType: "kpr" as const,
      status: "menunggu" as const,
      paymentStatus: "belum_bayar" as const,
      orderDate: isoDate(-6),
      paid: 0,
      next: isoDate(9),
    },
    {
      code: "TRX-2026-0002",
      customer: "Hendra Gunawan",
      property: "RKO-PLG-001",
      agentId: managerId,
      orderType: "bertahap" as const,
      status: "diproses" as const,
      paymentStatus: "cicilan" as const,
      orderDate: isoDate(-40),
      paid: 500_000_000,
      next: isoDate(-1),
    },
  ];

  for (const o of orderSeed) {
    const prop = propByCode.get(o.property);
    const custId = custByName.get(o.customer);
    if (!prop || !custId) continue;
    const [row] = await db
      .insert(orders)
      .values({
        code: o.code,
        customerId: custId,
        propertyId: prop.id,
        agentId: o.agentId,
        orderType: o.orderType,
        status: o.status,
        paymentStatus: o.paymentStatus,
        quantity: 1,
        totalPrice: prop.price,
        paidAmount: o.paid,
        orderDate: o.orderDate,
        nextPaymentDue: o.next,
        notes: `Transaksi ${o.property} untuk ${o.customer}.`,
      })
      .returning({ id: orders.id });

    if (row && o.paid > 0) {
      await db.insert(payments).values({
        orderId: row.id,
        amount: o.paid,
        method: o.orderType === "cash" ? "transfer" : "transfer",
        paidAt: o.orderDate,
        note: "Pembayaran tercatat sistem",
      });
    }
  }

  // Tandai unit yang sudah terjual/booking
  await db.execute(sql`update properties set status = 'terjual' where code in ('KVL-PLG-001','TNH-PLG-001')`);
  await db.execute(sql`update properties set status = 'booking' where code in ('RMH-PLG-001','RMH-PLG-002','RKO-PLG-001')`);
  await db.execute(sql`update properties set quantity = greatest(quantity - 1, 0) where code in ('KVL-PLG-001','TNH-PLG-001')`);

  await db.insert(auditLogs).values([
    {
      userId: ownerId,
      userName: "Sistem Kavlingo",
      action: "seed",
      entity: "sistem",
      entityId: null,
      detail: "Inisialisasi data contoh (pemilik, manajer, staf, inventaris, pelanggan, transaksi).",
    },
  ]);
}
