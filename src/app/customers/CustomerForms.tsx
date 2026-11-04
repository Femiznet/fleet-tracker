"use client";

import { useActionState } from "react";
import { addCustomer, deleteCustomer, updateCustomer, type SaveResult } from "./actions";

export type Customer = {
  id: string;
  name: string;
  group_name: string;
  cutoff_bar: number | string;
  trip_minutes: number | null;
  full_bar: number | string;
  active: boolean;
};

function Message({ result }: { result: SaveResult }) {
  if (!result) return null;
  return (
    <p role="status" className={result.ok ? "text-[var(--success)]" : "text-[var(--destructive)]"}>
      {result.message}
    </p>
  );
}

const input =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)/20] placeholder:text-[var(--muted)]";

export function CustomerRow({ customer }: { customer: Customer }) {
  const [result, action, pending] = useActionState<SaveResult, FormData>(
    updateCustomer,
    null,
  );
  const [deleteResult, deleteAction, deletePending] = useActionState<SaveResult, FormData>(
    deleteCustomer,
    null,
  );

  return (
    <form action={action} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <input type="hidden" name="id" value={customer.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--muted)]">
          WhatsApp group: {customer.group_name}
        </p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${customer.active ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--bg)] text-[var(--muted)]"}`}>
          {customer.active ? "On dashboard" : "Hidden"}
        </span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`name-${customer.id}`} className="text-sm font-medium text-[var(--fg)]">
            Name
          </label>
          <input
            id={`name-${customer.id}`}
            name="name"
            defaultValue={customer.name}
            required
            className={input}
          />
        </div>
        <div>
          <label
            htmlFor={`cutoff-${customer.id}`}
            className="text-sm font-medium text-[var(--fg)]"
          >
            Cutoff pressure (bar)
          </label>
          <input
            id={`cutoff-${customer.id}`}
            name="cutoff_bar"
            type="number"
            step="0.1"
            inputMode="decimal"
            defaultValue={customer.cutoff_bar}
            required
            className={input}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Lowest pressure they can run at. 20 until known.
          </p>
        </div>
        <div>
          <label
            htmlFor={`trip-${customer.id}`}
            className="text-sm font-medium text-[var(--fg)]"
          >
            Trip time (minutes)
          </label>
          <input
            id={`trip-${customer.id}`}
            name="trip_minutes"
            type="number"
            step="1"
            inputMode="numeric"
            defaultValue={customer.trip_minutes ?? ""}
            className={input}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Plant to customer, one way. Empty if unknown.
          </p>
        </div>
        <div>
          <label
            htmlFor={`full-${customer.id}`}
            className="text-sm font-medium text-[var(--fg)]"
          >
            Full skid pressure (bar)
          </label>
          <input
            id={`full-${customer.id}`}
            name="full_bar"
            type="number"
            step="0.1"
            inputMode="decimal"
            defaultValue={customer.full_bar}
            required
            className={input}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Used for standby skids. Keep 199 unless you know better.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
          <input type="checkbox" name="active" defaultChecked={customer.active} className="size-4 accent-[var(--brand)]" />
          Show on the dashboard
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand)]/10 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <Message result={result ?? deleteResult} />
        <button
          type="submit"
          formAction={deleteAction}
          disabled={deletePending}
          onClick={(event) => {
            if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) event.preventDefault();
          }}
          className="min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-50"
        >
          {deletePending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </form>
  );
}

export function NewGroupRow({ groupName }: { groupName: string }) {
  const [result, action, pending] = useActionState<SaveResult, FormData>(
    addCustomer,
    null,
  );

  return (
    <form
      action={action}
      className="flex flex-col items-stretch gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)] p-3 sm:flex-row sm:items-end sm:p-4"
    >
      <input type="hidden" name="group_name" value={groupName} />
      <div className="min-w-0 flex-1">
        <label className="text-sm font-medium text-[var(--fg)]">Customer name</label>
        <input
          name="name"
          defaultValue={groupName}
          required
          className={input}
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          WhatsApp group: {groupName}
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand)]/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add customer"}
      </button>
      <Message result={result} />
    </form>
  );
}
