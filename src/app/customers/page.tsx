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
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 bg-[var(--bg)] text-[var(--fg)]">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--fg)]">Customers</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Alerts are only as accurate as these numbers.
          {missingTrip > 0 && ` ${missingTrip} active customer${missingTrip === 1 ? " has" : "s have"} no trip time yet.`}
        </p>
      </header>

      {newGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-[var(--fg)]">New WhatsApp groups ({newGroups.length})</h2>
          <p className="text-sm text-[var(--muted)]">
            These groups have sent updates but are not customers yet. Add the ones that are customers.
          </p>
          {newGroups.map((g) => (
            <NewGroupRow key={g} groupName={g} />
          ))}
        </section>
      )}

      <section className="space-y-3">
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
