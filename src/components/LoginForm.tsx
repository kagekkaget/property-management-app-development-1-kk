"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/rbac";

const DEMO = [
  { role: "owner", email: "owner@kavlingo.id", password: "owner123", icon: "👑" },
  { role: "manager", email: "manager@kavlingo.id", password: "manager123", icon: "🧑‍💼" },
  { role: "staff", email: "staff@kavlingo.id", password: "staff123", icon: "🤝" },
] as const;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@kavlingo.id");
  const [password, setPassword] = useState("owner123");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Gagal masuk");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card className="p-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Masuk ke akun Anda</h2>
        <p className="mt-1 text-xs text-slate-500">
          Akses berbasis peran: pemilik, manajer, dan staf marketing.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@kavlingo.id"
            />
          </Field>
          <Field label="Kata sandi">
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                required
                minLength={6}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                {show ? "Sembunyikan" : "Lihat"}
              </button>
            </div>
          </Field>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Memproses…" : "Masuk"}
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Akun demo — klik untuk mengisi
          </p>
          <div className="mt-2 space-y-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                  setError(null);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span>{d.icon}</span>
                  {ROLE_LABEL[d.role]}
                </span>
                <span className="text-[11px] text-slate-500">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
      <p className="mt-4 text-center text-[11px] text-slate-400">
        Kata sandi disimpan sebagai hash scrypt bersalt. Sesi menggunakan cookie httpOnly berumur 7 hari.
      </p>
    </div>
  );
}
