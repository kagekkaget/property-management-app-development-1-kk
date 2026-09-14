# Kavlingo Palembang — Manajemen Pemasaran & Penjualan Properti

Platform manajemen inventaris properti, pelanggan, transaksi, dan laporan untuk pengembang serta agen properti di Palembang.

## Fitur Utama

- **📦 Inventaris Properti** — Kelola kavling, rumah, ruko, apartemen, tanah, dan gudang
- **👥 Pelanggan** — Profil, preferensi, riwayat transaksi, dan status PDP
- **🧾 Transaksi & Pembayaran** — Booking, KPR, pembayaran bertahap, dan pelunasan
- **📈 Laporan & Ekspor** — Laporan PDF dan CSV untuk inventaris, penjualan, pelanggan, dan risiko
- **🔒 Kepatuhan PDP** — Manajemen persetujuan data pribadi sesuai UU No. 27 Tahun 2022
- **📴 Mode Offline** — Sinkronisasi otomatis saat koneksi kembali
- **🛡️ Manajemen Pengguna & Peran** — Pemilik, Manajer, dan Staf Marketing

## Peran Akses

| Peran | Izin |
|-------|------|
| **Pemilik** | Akses penuh — semua fitur |
| **Manajer** | Kelola inventaris, pelanggan, transaksi, laporan, audit |
| **Staf Marketing** | Lihat & edit inventaris, pelanggan, transaksi, laporan |

## Demo Akun

| Email | Kata Sandi | Peran |
|-------|-----------|-------|
| `owner@kavlingo.id` | `owner123` | Pemilik |
| `manager@kavlingo.id` | `manager123` | Manajer |
| `staff@kavlingo.id` | `staff123` | Staf Marketing |

## Teknologi

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Neon / Supabase / database lokal)
- **ORM**: Drizzle ORM
- **Auth**: Cookie-based session (httpOnly, scrypt hash)

## Cara Download / Clone

### Melalui Git

```bash
git clone https://github.com/your-username/property-management-app.git
cd property-management-app
```

### Download ZIP

1. Buka repository GitHub ini
2. Klik tombol **"Code"** (hijau)
3. Klik **"Download ZIP"**
4. Ekstrak file ZIP

## Instalasi

### 1. Install Dependensi

```bash
npm install
```

### 2. Konfigurasi Environment

Salin file contoh dan atur database:

```bash
cp .env.example .env.local
```

Edit `.env.local` dan ganti `DATABASE_URL` dengan URL database Anda:

```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

### 3. Push Schema ke Database

```bash
npx drizzle-kit push
```

### 4. Jalankan Aplikasi

```bash
npm run dev
```

Aplikasi akan otomatis membuka di `http://localhost:3000`. Data contoh akan di-generate otomatis saat pertama kali diakses.

## Perintah Lain

| Perintah | Keterangan |
|----------|-----------|
| `npm run build` | Build produksi |
| `npm run start` | Jalankan server produksi |
| `npm run lint` | Jalankan ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npx drizzle-kit push` | Push schema ke database |
| `npx drizzle-kit studio` | Buka GUI database |

## Deploy ke Vercel

1. Push kode ke GitHub
2. Buka [vercel.com](https://vercel.com) → Import repository
3. Tambahkan `DATABASE_URL` di Vercel Project Settings → Environment Variables
4. Klik **Deploy**

### Langkah Tambahan untuk Vercel

Pastikan database (Neon, Supabase, dll.) sudah dibuat dan `DATABASE_URL` sudah diatur di Vercel. Schema harus sudah di-push sebelum atau setelah deploy pertama.

## Struktur Proyek

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── login/             # Halaman login
│   ├── (app)/             # Halaman utama (protected)
│   │   ├── dashboard/     # Dasbor operasional
│   │   ├── inventaris/    # Kelola properti
│   │   ├── pelanggan/     # Kelola pelanggan
│   │   ├── pesanan/       # Transaksi & pembayaran
│   │   ├── laporan/       # Laporan & ekspor
│   │   ├── pengguna/      # Manajemen pengguna
│   │   └── kepatuhan/     # Kepatuhan PDP & audit
│   └── api/               # API endpoints
│       ├── auth/          # Login, logout
│       ├── data/          # Data untuk frontend
│       ├── users/         # CRUD pengguna
│       ├── sync/          # Sinkronisasi offline
│       ├── export/        # Ekspor CSV
│       ├── backup/        # Cadangan data
│       └── health/        # Health check
├── components/            # React components
│   ├── AppShell.tsx       # Layout utama (sidebar, header)
│   ├── SyncProvider.tsx   # State management & sync
│   ├── LoginForm.tsx      # Form login
│   ├── DashboardView.tsx  # View dasbor
│   ├── InventoryView.tsx  # View inventaris
│   ├── CustomerView.tsx   # View pelanggan
│   ├── OrdersView.tsx     # View transaksi
│   ├── ReportsView.tsx    # View laporan
│   ├── UsersView.tsx      # View pengguna
│   ├── ComplianceView.tsx # View kepatuhan
│   └── ui.tsx             # UI components (Card, Button, Badge, dll.)
├── lib/                   # Utility & business logic
│   ├── types.ts           # TypeScript types
│   ├── auth.ts            # Auth & session management
│   ├── rbac.ts            # Role-based access control
│   ├── format.ts          # Formatting utilities
│   ├── data.ts            # Data access layer
│   ├── mutations.ts       # Database mutations
│   ├── analytics.ts       # Analytics & KPI calculations
│   └── csv.ts             # CSV export
└── db/                    # Database layer
    ├── schema.ts          # Drizzle schema
    ├── index.ts           # DB connection
    └── seed.ts            # Seed data
```

## Arsitektur

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│  Browser │────▶│ Next.js API   │────▶│  Drizzle ORM │────▶│ PostgreSQL  │
│ (React)  │◀────│ Routes        │◀────│              │◀────│ (Neon/Local)│
└──────────┘     └───────────────┘     └──────────────┘     └─────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ SyncProvider   │
              │ (Local State)  │
              │ + localStorage │
              │ + Service SW   │
              └───────────────┘
```

## Open Source oleh MZF - 2026

Aplikasi ini dilisensikan di bawah lisensi open source oleh **MZF - 2026**.

Hubungi: developer@mzf.example.com

---

*Kavlingo Palembang — Manajemen Pemasaran & Penjualan Properti*
