import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureSeeded().catch(() => undefined);
  const user = await getSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
