"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  createRouteMilestone,
  type CreateStationState,
} from "./actions";

const initialState: CreateStationState = null;

export default function CreateMilestoneForm() {
  const [state, formAction, pending] = useActionState(
    createRouteMilestone,
    initialState
  );

  useEffect(() => {
    if (state?.status === "success") {
      toast.success(state.message);
    } else if (state?.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-medium">
        Milestone name
        <input
          name="name"
          required
          maxLength={120}
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
          placeholder="e.g. Ore, Kogi"
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Description or area
        <input
          name="location"
          maxLength={300}
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
          placeholder="Optional"
        />
      </label>

      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="text-sm font-medium">Milestone coordinates</legend>
        <p className="text-xs text-muted-foreground">
          Enter the place coordinates in decimal degrees.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            Latitude
            <input
              name="latitude"
              type="number"
              required
              min="-90"
              max="90"
              step="any"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
              placeholder="e.g. 7.377"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Longitude
            <input
              name="longitude"
              type="number"
              required
              min="-180"
              max="180"
              step="any"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
              placeholder="e.g. 3.947"
            />
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50 sm:col-span-2"
      >
        {pending ? "Adding milestone..." : "Add route milestone"}
      </button>
    </form>
  );
}
