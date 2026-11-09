"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

type Vehicle = Pick<
  Tables<"vehicle_tracking">,
  | "plate_number"
  | "fleet_owner"
  | "status"
  | "speed"
  | "current_address"
  | "destination_name"
  | "remaining_distance_km"
  | "last_sync"
>;

function isMoving(vehicle: Vehicle) {
  return vehicle.speed > 0 || ["moving", "running"].includes(vehicle.status.toLowerCase());
}

export default function VehicleTable({ vehicles }: { vehicles: Vehicle[] }) {
  const router = useRouter();

  useEffect(() => {
    let refreshTimeout: number | undefined;
    const refresh = () => {
      if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase
      .channel("admin-vehicle-directory")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicle_tracking" }, refresh)
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Vehicle realtime subscription ${status.toLowerCase()}.`);
        }
      });
    const intervalId = window.setInterval(refresh, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[54rem] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-3">Vehicle</th>
            <th scope="col" className="px-5 py-3">Movement</th>
            <th scope="col" className="px-5 py-3">Current location</th>
            <th scope="col" className="px-5 py-3">Destination</th>
            <th scope="col" className="px-5 py-3 text-right">Speed</th>
            <th scope="col" className="px-5 py-3">Last GPS sync</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vehicles.map((vehicle) => {
            const moving = isMoving(vehicle);
            return (
              <tr key={vehicle.plate_number} className="hover:bg-slate-50/70">
                <th scope="row" className="px-5 py-4 font-medium">
                  <span className="block">{vehicle.plate_number}</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">{vehicle.fleet_owner}</span>
                </th>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${moving ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${moving ? "bg-emerald-600" : "bg-slate-400"}`} />
                    {moving ? "Moving" : "Stopped"}
                  </span>
                </td>
                <td className="max-w-64 truncate px-5 py-4 text-slate-600">{vehicle.current_address || "Location unavailable"}</td>
                <td className="px-5 py-4">{vehicle.destination_name || "No destination"}</td>
                <td className="px-5 py-4 text-right tabular-nums">{vehicle.speed} km/h</td>
                <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                  <time dateTime={vehicle.last_sync}>{new Date(vehicle.last_sync).toLocaleString()}</time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
