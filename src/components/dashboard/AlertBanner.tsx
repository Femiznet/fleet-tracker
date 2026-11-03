"use client";

import { useEffect } from "react";
import type { CustomerStatus } from "@/lib/calc/monitor";

const BASE_TITLE = "Customer monitor";

export default function AlertBanner({
  statuses,
  enabled,
}: {
  statuses: CustomerStatus[];
  enabled: boolean;
}) {
  const critical = statuses.filter((s) => s.status === "critical");
  const sendNow = statuses.filter((s) => s.status === "send_now");
  const count = critical.length + sendNow.length;

  // Shows the number in the browser tab so it is visible from other tabs.
  useEffect(() => {
    document.title = enabled && count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [enabled, count]);

  if (!enabled || count === 0) return null;

  return (
    <div role="alert" className="mb-6 space-y-2">
      {critical.length > 0 && (
        <div className="rounded-lg border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-4 text-red-900">
          <p className="font-medium">
            Critical: {critical.map((c) => c.name).join(", ")}
          </p>
          <p className="text-sm">
            A skid sent now would arrive after they run out. Act immediately.
          </p>
        </div>
      )}
      {sendNow.length > 0 && (
        <div className="rounded-lg border border-orange-200 border-l-4 border-l-orange-500 bg-orange-50 p-4 text-orange-900">
          <p className="font-medium">
            Send a skid now: {sendNow.map((c) => c.name).join(", ")}
          </p>
          <p className="text-sm">The send-by time has passed or is due.</p>
        </div>
      )}
    </div>
  );
}