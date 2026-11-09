"use client";

import { useState } from "react";
import { MapPinned, Plus } from "lucide-react";
import CreateMilestoneForm from "../station/create-milestone-form";
import CreateStationForm from "../station/create-station-form";

type PlaceForm = "station" | "milestone" | null;

export default function PlaceCreatePanel() {
  const [selectedForm, setSelectedForm] = useState<PlaceForm>(null);

  return (
    <details id="create-place" className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-700">
          <Plus aria-hidden="true" className="size-5" />
        </span>
        <span className="flex-1">
          <span className="block font-medium">Add a place</span>
          <span className="mt-0.5 block text-sm text-slate-500">Register a customer station or route milestone.</span>
        </span>
        <span className="text-sm text-slate-500 group-open:hidden">Open</span>
        <span className="hidden text-sm text-slate-500 group-open:inline">Close</span>
      </summary>
      <div className="border-t border-slate-200 p-4 sm:p-5">
        {selectedForm === null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedForm("station")}
              className="flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 p-4 text-left hover:border-slate-300 hover:bg-slate-50"
            >
              <Plus aria-hidden="true" className="size-5 text-slate-600" />
              <span>
                <span className="block text-sm font-medium">Customer station</span>
                <span className="mt-0.5 block text-xs text-slate-500">Create a destination and invite a customer.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedForm("milestone")}
              className="flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 p-4 text-left hover:border-slate-300 hover:bg-slate-50"
            >
              <MapPinned aria-hidden="true" className="size-5 text-emerald-800" />
              <span>
                <span className="block text-sm font-medium">Route milestone</span>
                <span className="mt-0.5 block text-xs text-slate-500">Save a named point along a delivery route.</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => setSelectedForm(null)} className="text-sm font-medium text-emerald-800 hover:underline">
              ← Choose a different place type
            </button>
            {selectedForm === "station" ? <CreateStationForm /> : <CreateMilestoneForm />}
          </div>
        )}
      </div>
    </details>
  );
}
