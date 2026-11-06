"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { unregisterCustomer, registerFromUpdate, type SaveResult } from "@/app/dashboard/actions";

type Update = {
  id: string;
  group_name: string | null;
  notification_title: string | null;
  received_at: string;
  extracted_data: Record<string, unknown> | null;
  processing_status: string;
  message: string;
  review_reason: string | null;
};

type Customer = {
  id: string;
  name: string;
  group_name: string;
};

function formatExtracted(data: Record<string, unknown> | null): string[] {
  if (!data) return [];
  const lines: string[] = [];
  if (data.current_pressure_bar != null) lines.push(`Pressure: ${data.current_pressure_bar} bar`);
  if (data.flow_rate != null) lines.push(`Flow: ${data.flow_rate} scm/h`);
  if (data.meter_reading_scm != null) lines.push(`Meter: ${data.meter_reading_scm} scm`);
  if (data.skid_in_use_count != null) lines.push(`Skids in use: ${data.skid_in_use_count}`);
  if (data.standby_skids != null) lines.push(`Standby: ${data.standby_skids}`);
  if (data.empty_skids != null) lines.push(`Empty: ${data.empty_skids}`);
  if (data.available_trucks != null) lines.push(`Trucks: ${data.available_trucks}`);
  return lines;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    completed: "bg-[var(--success)]/10 text-[var(--success)]",
    needs_review: "bg-[var(--warning)]/10 text-[var(--warning)]",
    failed: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
    pending: "bg-[var(--muted)]/10 text-[var(--muted)]",
    processing: "bg-[var(--info)]/10 text-[var(--info)]",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[status] ?? "bg-[var(--muted)]/10 text-[var(--muted)]"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function RegisteredUpdateRow({
  update,
  customer,
}: {
  update: Update;
  customer: Customer;
}) {
  const [result, action, pending] = useActionState<SaveResult, FormData>(
    unregisterCustomer,
    null
  );
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (result) {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    }
  }, [result]);

  const extracted = formatExtracted(update.extracted_data);

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--fg)]">{customer.name}</p>
          <p className="text-xs text-[var(--muted)]">
            {new Date(update.received_at).toLocaleString("en-GB", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "Africa/Lagos",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(update.processing_status)}
          <form action={action}>
            <input type="hidden" name="id" value={customer.id} />
            <button
              type="submit"
              disabled={pending}
              className="min-h-9 rounded-lg border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10 disabled:opacity-50"
            >
              {pending ? "Unregistering…" : "Unregister"}
            </button>
          </form>
        </div>
      </div>

      {extracted.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {extracted.map((line, i) => (
            <span
              key={i}
              className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--fg)]"
            >
              {line}
            </span>
          ))}
        </div>
      )}

      {update.review_reason && (
        <p className="mt-2 text-xs text-[var(--warning)]">
          Review: {update.review_reason}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="mt-3 text-xs font-medium text-[var(--brand)] underline underline-offset-2"
      >
        {showRaw ? "Hide raw message" : "View raw message"}
      </button>
      {showRaw && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[var(--card)] p-3 text-xs text-[var(--muted)] whitespace-pre-wrap">
          {update.message}
        </pre>
      )}
    </li>
  );
}



export default function UpdatesPanel({
  registered,
  unregistered,
  customers,
}: {
  registered: Update[];
  unregistered: Update[];
  customers: Customer[];
}) {
  const customerByGroup = new Map(customers.map((c) => [c.group_name, c]));
  const customerByName = new Map(
    customers.map((c) => [c.name.toLowerCase(), c])
  );

  const unregisteredByGroup = new Map<string, Update[]>();
  for (const u of unregistered) {
    const groupName = u.notification_title || u.group_name || "Unknown group";
    if (!unregisteredByGroup.has(groupName)) {
      unregisteredByGroup.set(groupName, []);
    }
    unregisteredByGroup.get(groupName)!.push(u);
  }

  return (
    <section className="mb-6 grid gap-4 lg:grid-cols-2">
      {/* Registered customers */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Registered customers
          </h2>
          <span className="rounded-full bg-[var(--success)]/10 px-3 py-1 text-xs font-medium text-[var(--success)]">
            {registered.length} updates
          </span>
        </div>
        {registered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            No updates from registered customers.
          </p>
        ) : (
          <ul className="space-y-3">
            {registered.map((u) => {
              const groupName = u.notification_title || u.group_name;
              let customerMatch: Customer | undefined = groupName
                ? customerByGroup.get(groupName)
                : undefined;
              if (!customerMatch) {
                const customerName =
                  u.extracted_data?.customer_name as string | undefined;
                if (customerName) {
                  customerMatch = customerByName.get(customerName.toLowerCase());
                }
              }
              if (!customerMatch) return null;
              const customer = customerMatch;

              return (
                <RegisteredUpdateRow
                  key={u.id}
                  update={u}
                  customer={customer}
                />
              );
            })}
          </ul>
        )}
      </div>

      {/* Unregistered customers (aggregated by group) */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Unregistered customers
          </h2>
          <span className="rounded-full bg-[var(--warning)]/10 px-3 py-1 text-xs font-medium text-[var(--warning)]">
            {Object.keys(unregisteredByGroup).length} group{unregisteredByGroup.size !== 1 ? "s" : ""} ({unregistered.length} updates)
          </span>
        </div>
        {Object.keys(unregisteredByGroup).length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            No unregistered customers.
          </p>
        ) : (
          <ul className="space-y-3">
            {Array.from(unregisteredByGroup.entries()).map(([groupName, groupUpdates]) => (
              <li key={groupName} className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--fg)]">{groupName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(groupUpdates[0].received_at).toLocaleString("en-GB", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Africa/Lagos",
                      })}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {groupUpdates.length} update{groupUpdates.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <form action={registerFromUpdate}>
                    <input type="hidden" name="name" value={groupName} />
                    <input type="hidden" name="group_name" value={groupName} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="min-h-9 rounded-lg border border-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand)]/10 disabled:opacity-50"
                    >
                      Register
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}