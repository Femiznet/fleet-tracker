import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CustomerRow, NewGroupRow, type Customer } from "./CustomerForms";

export const instant = false

export default async function CustomersPage() {
  await connection()

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [customersRes, groupsRes] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("id, name, group_name, cutoff_bar, trip_minutes, full_bar, active")
      .order("name"),
    supabaseAdmin
      .from("whatsapp_updates")
      .select("group_name")
      .not("group_name", "is", null)
      .order("received_at", { ascending: false })
      .limit(1000),
  ]);

  if (customersRes.error) throw customersRes.error;

  const customers = (customersRes.data ?? []) as Customer[];
  const known = new Set(customers.map((c) => c.group_name));
  const newGroups = [
    ...new Set((groupsRes.data ?? []).map((g) => g.group_name as string)),
  ].filter((g) => !known.has(g));

  const missingTrip = customers.filter((c) => c.active && c.trip_minutes === null).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 text-[var(--fg)] sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">People and delivery settings</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Set the operating numbers used to calculate delivery alerts.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold tabular-nums">{customers.length}</span>
          <span className="ml-2 text-[var(--muted)]">customers</span>
          {missingTrip > 0 && (
            <p className="mt-1 text-xs text-[var(--warning)]">
              {missingTrip} active {missingTrip === 1 ? "customer has" : "customers have"} no trip time.
            </p>
          )}
        </div>
      </header>

      {newGroups.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <div>
            <h2 className="font-semibold text-[var(--fg)]">New WhatsApp groups ({newGroups.length})</h2>
          <p className="text-sm text-[var(--muted)]">
            These groups have sent updates but are not customers yet. Add the ones that are customers.
          </p>
          </div>
          {newGroups.map((g) => (
            <NewGroupRow key={g} groupName={g} />
          ))}
        </section>
      )}

      <section aria-label="Customer settings" className="space-y-4">
        {customers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
            No customers yet. Add a WhatsApp group above once it has sent an update.
          </p>
        ) : (
          customers.map((c) => <CustomerRow key={c.id} customer={c} />)
        )}
      </section>
    </main>
  );
}
