"use client";

import { useActionState } from "react";
import CustomerUpdateSimulator from "./customer-update-simulator";
import {
  updateVehicleDispatch,
  updateVehicleDispatchStatus,
  type DispatchActionState,
} from "./actions";
import DispatchResourceSelect from "../dispatches/resource-select";

interface VehiclePosition {
  plate_number: string;
  current_address: string | null;
  lat: number;
  lon: number;
  approaching_next: string;
  speed: number;
  remaining_distance_km: number | null;
  last_sync: string;
}

const initialState: DispatchActionState = null;

function ActionMessage({ state }: { state: DispatchActionState }) {
  if (!state) return null;

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm ${state.status === "error" ? "text-red-600" : "text-green-700"}`}
    >
      {state.message}
    </p>
  );
}

export default function TripManagement({
  dispatch,
  vehicle,
}: {
  dispatch: {
    id: string;
    plate_number: string;
    customer_station_id: string;
    destination_name: string;
    destination_lat: number;
    destination_lon: number;
    start_lat: number;
    start_lon: number;
    started_at: string;
  };
  vehicle: VehiclePosition;
}) {
  const [editState, editAction, editPending] = useActionState(
    updateVehicleDispatch,
    initialState
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateVehicleDispatchStatus,
    initialState
  );

  return (
    <details className="rounded-lg border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        View trip movement and manage trip
      </summary>
      <div className="space-y-6 border-t border-border p-4">
        <section aria-label="Trip movement" className="space-y-3">
          <h4 className="font-medium">Latest movement</h4>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">Current location</dt>
              <dd className="mt-1 font-medium">
                {vehicle.current_address?.trim() || "Location unavailable"}
              </dd>
              <dd className="text-xs text-muted-foreground">
                {vehicle.lat.toFixed(5)}, {vehicle.lon.toFixed(5)}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">Next milestone</dt>
              <dd className="mt-1 font-medium">
                {vehicle.approaching_next || "Unknown"}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">Destination</dt>
              <dd className="mt-1 font-medium">{dispatch.destination_name}</dd>
              <dd className="text-xs text-muted-foreground">
                {dispatch.destination_lat.toFixed(5)}, {dispatch.destination_lon.toFixed(5)}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">Distance remaining</dt>
              <dd className="mt-1 font-medium">
                {vehicle.remaining_distance_km === null
                  ? "Unavailable"
                  : `${vehicle.remaining_distance_km.toFixed(1)} km`}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">Speed</dt>
              <dd className="mt-1 font-medium">{vehicle.speed} km/h</dd>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">Last GPS update</dt>
              <dd className="mt-1 font-medium">
                <time dateTime={vehicle.last_sync}>
                  {new Date(vehicle.last_sync).toLocaleString()}
                </time>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            GPS values reflect the latest tracker sync and may not be live.
          </p>
        </section>

        <CustomerUpdateSimulator
          plateNumber={dispatch.plate_number}
          destinationName={dispatch.destination_name}
          initialVehicle={vehicle}
        />

        <section aria-label="Edit trip details" className="space-y-3">
          <h4 className="font-medium">Correct trip details</h4>
          <form action={editAction} className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <input type="hidden" name="dispatchId" value={dispatch.id} />
            <DispatchResourceSelect
              name="plateNumber"
              id={`edit-${dispatch.id}-vehicle`}
              resource="vehicle"
              label="Vehicle"
              initialValue={dispatch.plate_number}
              initialLabel={dispatch.plate_number}
              disabled={editPending || statusPending}
            />
            <DispatchResourceSelect
              name="customerStationId"
              id={`edit-${dispatch.id}-station`}
              resource="station"
              label="Customer station"
              initialValue={dispatch.customer_station_id}
              initialLabel={dispatch.destination_name}
              disabled={editPending || statusPending}
            />
            <button
              type="submit"
              disabled={editPending || statusPending}
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
            >
              {editPending ? "Saving changes..." : "Save trip changes"}
            </button>
            <div className="sm:col-span-2">
              <ActionMessage state={editState} />
            </div>
          </form>
        </section>

        <section aria-label="Close trip" className="space-y-3 border-t border-border pt-4">
          <h4 className="font-medium">Finish or cancel trip</h4>
          <div className="flex flex-wrap gap-3">
            <form action={statusAction}>
              <input type="hidden" name="dispatchId" value={dispatch.id} />
              <input type="hidden" name="status" value="arrived" />
              <button
                type="submit"
                disabled={statusPending || editPending}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark completed
              </button>
            </form>
            <form
              action={statusAction}
              onSubmit={(event) => {
                if (!window.confirm(`Cancel the dispatch for ${dispatch.plate_number}?`)) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="dispatchId" value={dispatch.id} />
              <input type="hidden" name="status" value="cancelled" />
              <button
                type="submit"
                disabled={statusPending || editPending}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel trip
              </button>
            </form>
          </div>
          <ActionMessage state={statusState} />
        </section>
      </div>
    </details>
  );
}
