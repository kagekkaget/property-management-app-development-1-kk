import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { UsersView } from "@/components/UsersView";

export const dynamic = "force-dynamic";

export default async function PenggunaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, "user.manage")) redirect("/dashboard");
  return <UsersView />;
}
