import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeeded().catch(() => undefined);
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <section className="relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 p-8 text-white lg:p-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-2xl">🏘️</div>
            <div>
              <p className="text-lg font-extrabold tracking-tight">Kavlingo Palembang</p>
              <p className="text-xs text-emerald-100">Manajemen Pemasaran &amp; Penjualan Properti</p>
            </div>
          </div>

          <h1 className="mt-10 max-w-xl text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
            Kurangi properti menganggur, optimalkan stok unit, dan tutup penjualan lebih cepat.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-emerald-50">
            Satu platform untuk memantau inventaris kavling, rumah, ruko, dan tanah di Palembang — lengkap
            dengan peringatan stok menipis, listing mendekati kadaluarsa, piutang jatuh tempo, manajemen
            pelanggan, hingga laporan PDF &amp; CSV.
          </p>

          <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["📦", "Pelacakan stok properti real-time"],
              ["⏰", "Peringatan listing kadaluarsa"],
              ["👥", "Profil & preferensi pelanggan"],
              ["🧾", "Status pembayaran & piutang"],
              ["📄", "Laporan PDF dan CSV"],
              ["📴", "Mode offline + sinkronisasi otomatis"],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5">
                <span>{icon}</span>
                <span className="text-xs font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 text-[11px] text-emerald-100">
          Data pribadi pelanggan diproses sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-slate-50 p-6 lg:p-14">
        <LoginForm />
      </section>
    </main>
  );
}
