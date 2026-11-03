"use client";

import { useActionState } from "react";
import { addCustomer, updateCustomer, type SaveResult } from "./actions";

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
    <p role="status" className={result.ok ? "text-emerald-700" : "text-red-700"}>
      {result.message}
    </p>
  );
}

const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2";

export function CustomerRow({ customer }: { customer: Customer }) {
  const [result, action, pending] = useActionState<SaveResult, FormData>(updateCustomer, null);

  return (
    <form action={action} className="rounded-lg border border-slate-200 bg-white p-4">
      <input type="hidden" name="id" value={customer.id} />
      <p className="text-xs text-slate-500">WhatsApp group: {customer.group_name}</p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`name-${customer.id}`} className="text-sm font-medium">Name</label>
          <input id={`name-${customer.id}`} name="name" defaultValue={customer.name} required className={input} />
        </div>
        <div>
          <label htmlFor={`cutoff-${customer.id}`} className="text-sm font-medium">Cutoff pressure (bar)</label>
          <input id={`cutoff-${customer.id}`} name="cutoff_bar" type="number" step="0.1" inputMode="decimal"
            defaultValue={customer.cutoff_bar} required className={input} />
          <p className="mt-1 text-xs text-slate-500">Lowest pressure they can run at. 20 until known.</p>
        </div>
        <div>
          <label htmlFor={`trip-${customer.id}`} className="text-sm font-medium">Trip time (minutes)</label>
          <input id={`trip-${customer.id}`} name="trip_minutes" type="number" step="1" inputMode="numeric"
            defaultValue={customer.trip_minutes ?? ""} className={input} />
          <p className="mt-1 text-xs text-slate-500">Plant to customer, one way. Empty if unknown.</p>
        </div>
        <div>
          <label htmlFor={`full-${customer.id}`} className="text-sm font-medium">Full skid pressure (bar)</label>
          <input id={`full-${customer.id}`} name="full_bar" type="number" step="0.1" inputMode="decimal"
            defaultValue={customer.full_bar} required className={input} />
          <p className="mt-1 text-xs text-slate-500">Used for standby skids. Keep 199 unless you know better.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={customer.active} />
          Show on the dashboard
        </label>
        <button type="submit" disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <Message result={result} />
      </div>
    </form>
  );
}

export function NewGroupRow({ groupName }: { groupName: string }) {
  const [result, action, pending] = useActionState<SaveResult, FormData>(addCustomer, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-4">
      <input type="hidden" name="group_name" value={groupName} />
      <div className="min-w-[14rem] flex-1">
        <label className="text-sm font-medium">Customer name</label>
        <input name="name" defaultValue={groupName} required className={input} />
        <p className="mt-1 text-xs text-slate-500">WhatsApp group: {groupName}</p>
      </div>
      <button type="submit" disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add customer"}
      </button>
      <Message result={result} />
    </form>
  );
}