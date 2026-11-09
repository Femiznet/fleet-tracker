"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { startVehicleDispatch, type StartDispatchState } from "../dispatch/actions";
import DispatchResourceSelect from "./resource-select";

export default function StartDispatchForm() {
  const [state, setState] = useState<StartDispatchState>(null);
  const [optimisticPlate, setOptimisticPlate] = useOptimistic<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectionVersion, setSelectionVersion] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const plateNumber = formData.get("plateNumber");
        const customerStationId = formData.get("customerStationId");

        if (typeof plateNumber !== "string" || !plateNumber || typeof customerStationId !== "string" || !customerStationId) {
          setState({ status: "error", message: "Search for and select both a vehicle and a customer station." });
          return;
        }

        setState(null);
        startTransition(async () => {
          setOptimisticPlate(plateNumber);
          const result = await startVehicleDispatch(state, formData);
          setState(result);
          if (result?.status === "success") {
            formRef.current?.reset();
            setSelectionVersion((version) => version + 1);
          }
        });
      }}
      className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
    >
      <DispatchResourceSelect key={`vehicle-${selectionVersion}`} name="plateNumber" resource="vehicle" label="Vehicle" disabled={pending} />
      <DispatchResourceSelect key={`station-${selectionVersion}`} name="customerStationId" resource="station" label="Customer station" disabled={pending} />
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {pending ? `Starting ${optimisticPlate ?? "dispatch"}…` : "Start dispatch"}
        </button>
        {state && (
          <p role={state.status === "error" ? "alert" : "status"} className={`mt-3 text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-800"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
