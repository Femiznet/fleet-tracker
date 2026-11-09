import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Fuel } from "lucide-react";
import SignOutButton from "@/components/sign-out-button";
import PageLoading from "@/components/page-loading";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CustomerNavigation from "./navigation";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading label="Loading customer workspace" />}>
      <AuthorizedCustomerLayout>{children}</AuthorizedCustomerLayout>
    </Suspense>
  );
}

async function AuthorizedCustomerLayout({ children }: { children: ReactNode }) {
  await connection();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(`Could not verify customer session: ${authError.message}`);
  if (!user) redirect("/auth/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(`Could not verify customer permissions: ${profileError.message}`);
  if (profile?.role !== "customer") redirect("/admin/dashboard");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/customer/dashboard" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-emerald-300">
              <Fuel aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Fleet Operations</span>
              <span className="block text-xs text-slate-500">Customer workspace</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-1">
            <CustomerNavigation icon="overview" href="/customer/dashboard" label="Overview" />
            <CustomerNavigation icon="report" href="/customer/update" label="Station report" />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
