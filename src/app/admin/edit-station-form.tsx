"use client";

import { useActionState } from "react";
import {
  updateCustomerStation,
  type UpdateStationState,
} from "./actions";

const initialState: UpdateStationState = null;

type EditableStation = {
  id: string;
  name: string;
  type: "METER" | "SELF-PICK" | "WAYBILL" | null;
  distance: number | null;
  location: string | null;
};

export default function EditStationForm({
  station,
}: {
  station: EditableStation;
}) {
  const [state, formAction, pending] = useActionState(
    updateCustomerStation,
    initialState
  );

  return (
    <details className="mt-4 border-t border-[var(--border)] pt-3">
      <summary className="cursor-pointer text-sm font-medium">Edit station details</summary>
      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="stationId" value={station.id} />

        <label className="space-y-2 text-sm font-medium">
          Station name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={station.name}
            className="w-full rounded-lg border bg-transparent p-3"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Delivery type
          <select
            name="type"
            defaultValue={station.type ?? ""}
            className="w-full rounded-lg border bg-background p-3"
          >
            <option value="">Not specified</option>
            <option value="METER">Meter</option>
            <option value="SELF-PICK">Self-pick</option>
            <option value="WAYBILL">Waybill</option>
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium">
          Distance
          <input
            name="distance"
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            defaultValue={station.distance ?? ""}
            className="w-full rounded-lg border bg-transparent p-3"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Location
          <input
            name="location"
            maxLength={300}
            defaultValue={station.location ?? ""}
            className="w-full rounded-lg border bg-transparent p-3"
          />
        </label>

        {state && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`text-sm sm:col-span-2 ${
              state.status === "error" ? "text-red-600" : "text-green-700"
            }`}
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--fg)] p-3 font-semibold text-[var(--bg)] disabled:opacity-50 sm:col-span-2"
        >
          {pending ? "Saving changes..." : "Save station"}
        </button>
      </form>
    </details>
  );
}
