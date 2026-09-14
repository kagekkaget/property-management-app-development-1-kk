import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SyncProvider } from "@/components/SyncProvider";

export const metadata: Metadata = {
  title: "Kavlingo Palembang — Manajemen Pemasaran & Penjualan Properti",
  description:
    "Platform manajemen inventaris properti, pelanggan, transaksi, dan laporan untuk pengembang serta agen properti di Palembang.",
  applicationName: "Kavlingo Palembang",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  );
}
