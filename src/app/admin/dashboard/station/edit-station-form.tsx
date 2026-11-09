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
  place_kind: string;
  type: "METER" | "SELF-PICK" | "WAYBILL" | null;
  distance: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
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
    <summary className="cursor-pointer text-sm font-medium">
      Edit {station.place_kind === "milestone" ? "milestone" : "station"} details
    </summary>
    <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="stationId" value={station.id} />
      {station.place_kind === "milestone" && (
        <>
          <input type="hidden" name="type" value="" />
          <input type="hidden" name="distance" value="" />
        </>
      )}

        <label className="space-y-2 text-sm font-medium">
          Station name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={station.name}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
          />
        </label>

        {station.place_kind !== "milestone" && (
          <>
            <label className="space-y-2 text-sm font-medium">
              Delivery type
              <select
                name="type"
                defaultValue={station.type ?? ""}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
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
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
              />
            </label>
          </>
        )}

        <label className="space-y-2 text-sm font-medium">
          Location
          <input
            name="location"
            maxLength={300}
            defaultValue={station.location ?? ""}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
          />
        </label>

        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">
            {station.place_kind === "milestone" ? "Milestone coordinates" : "Station coordinates"}
          </legend>
          <p className="text-xs text-muted-foreground">
            Enter decimal degrees. Add both coordinates or leave both blank.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Latitude
              <input
                name="latitude"
                type="number"
                min="-90"
                max="90"
                step="any"
                required={station.place_kind === "milestone"}
                defaultValue={station.latitude ?? ""}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Longitude
              <input
                name="longitude"
                type="number"
                min="-180"
                max="180"
                step="any"
                required={station.place_kind === "milestone"}
                defaultValue={station.longitude ?? ""}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
              />
            </label>
          </div>
        </fieldset>

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
          className="min-h-11 rounded-lg bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50 sm:col-span-2"
        >
          {pending ? "Saving changes..." : `Save ${station.place_kind === "milestone" ? "milestone" : "station"}`}
        </button>
      </form>
    </details>
  );
}
