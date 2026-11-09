"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

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

interface ChatMessage {
  id: number;
  text: string;
  sentAt: string;
}

function createUpdateMessage(vehicle: VehiclePosition, destinationName: string) {
  const currentLocation =
    vehicle.current_address?.trim() || `${vehicle.lat.toFixed(5)}, ${vehicle.lon.toFixed(5)}`;
  const reportedAt = new Date(vehicle.last_sync).toLocaleTimeString();
  const nextMilestone =
    vehicle.approaching_next && vehicle.approaching_next !== "Unknown"
      ? `Approaching ${vehicle.approaching_next}.`
      : "Next route milestone is not available yet.";
  const distance =
    vehicle.remaining_distance_km === null
      ? ""
      : ` Distance remaining: ${vehicle.remaining_distance_km.toFixed(1)} km.`;

  return `Vehicle ${vehicle.plate_number} is currently near ${currentLocation}. ${nextMilestone} Destination: ${destinationName}. Speed: ${vehicle.speed} km/h.${distance} Position reported at ${reportedAt}.`;
}

export default function CustomerUpdateSimulator({
  plateNumber,
  destinationName,
  initialVehicle,
}: {
  plateNumber: string;
  destinationName: string;
  initialVehicle: VehiclePosition;
}) {
  const [intervalMinutes, setIntervalMinutes] = useState("30");
  const [isRunning, setIsRunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const sendingRef = useRef(false);

  const sendUpdate = useCallback(async () => {
    if (sendingRef.current) return;

    sendingRef.current = true;
    setIsSending(true);
    setErrorMessage("");

    try {
      const { data: vehicle, error } = await supabase
        .from("vehicle_tracking")
        .select("plate_number, current_address, lat, lon, approaching_next, speed, remaining_distance_km, last_sync")
        .eq("plate_number", plateNumber)
        .maybeSingle();

      if (error) {
        console.error("Could not load vehicle position for customer update simulation:", error);
        setErrorMessage("Could not load the latest vehicle position. Please try again.");
        return;
      }

      if (!vehicle) {
        setErrorMessage("This vehicle is no longer available.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now(),
          text: createUpdateMessage(vehicle, destinationName),
          sentAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error("Customer update simulation failed:", error);
      setErrorMessage("Could not load the latest vehicle position. Please try again.");
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }, [destinationName, plateNumber]);

  const parsedInterval = Number(intervalMinutes);

  useEffect(() => {
    if (!isRunning || !Number.isInteger(parsedInterval) || parsedInterval < 1 || parsedInterval > 1440) {
      return;
    }

    const timerId = window.setInterval(() => {
      void sendUpdate();
    }, parsedInterval * 60 * 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning, parsedInterval, sendUpdate]);

  return (
    <details className="rounded-lg border border-border bg-muted/20">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Test customer update chat
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          UI-only simulation. No messages are sent to a real customer.
        </p>
        <p className="text-sm text-muted-foreground">
          Latest known position: {initialVehicle.current_address?.trim() || `${initialVehicle.lat.toFixed(5)}, ${initialVehicle.lon.toFixed(5)}`}
          {" · "}Approaching {initialVehicle.approaching_next || "unknown"}
          {" · "}GPS sync {new Date(initialVehicle.last_sync).toLocaleString()}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm font-medium">
            Send every (minutes)
            <input
              type="number"
              min="1"
              max="1440"
              step="1"
              value={intervalMinutes}
              onChange={(event) => setIntervalMinutes(event.target.value)}
              className="block w-36 rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => setIsRunning((running) => !running)}
            disabled={!Number.isInteger(parsedInterval) || parsedInterval < 1 || parsedInterval > 1440}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? "Stop updates" : "Start updates"}
          </button>
          <button
            type="button"
            onClick={() => void sendUpdate()}
            disabled={isSending}
            className="rounded-lg bg-[var(--fg)] px-3 py-2 text-sm font-medium text-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Loading latest position..." : "Send update now"}
          </button>
        </div>

        <div
          aria-live="polite"
          className="max-h-72 min-h-28 space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-3"
        >
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No updates yet. Send a test update to preview the customer message.
            </p>
          ) : (
            messages.map((message) => (
              <article key={message.id} className="ml-auto max-w-xl rounded-lg bg-sky-100 p-3 text-sm text-slate-900">
                <p>{message.text}</p>
                <time dateTime={message.sentAt} className="mt-2 block text-right text-xs text-slate-600">
                  {new Date(message.sentAt).toLocaleTimeString()}
                </time>
              </article>
            ))
          )}
        </div>
        {errorMessage && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          The first automatic update arrives after {intervalMinutes || "—"} minute(s). Send one now to test the format.
        </p>
      </div>
    </details>
  );
}
