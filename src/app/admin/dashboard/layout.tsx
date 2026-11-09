import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import PageLoading from "@/components/page-loading";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminAppShell from "./navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading label="Loading admin workspace" />}>
      <AuthorizedAdminLayout>{children}</AuthorizedAdminLayout>
    </Suspense>
  );
}

async function AuthorizedAdminLayout({ children }: { children: ReactNode }) {
  await connection();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Could not verify admin session: ${authError.message}`);
  }
  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not verify admin permissions: ${profileError.message}`);
  }
  if (profile?.role !== "admin") {
    redirect("/customer/dashboard");
  }

  return <AdminAppShell>{children}</AdminAppShell>;
}
