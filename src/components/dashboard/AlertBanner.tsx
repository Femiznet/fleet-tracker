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
        <div className="rounded-xl border border-[var(--critical)]/20 border-l-4 border-l-[var(--critical)] bg-[var(--critical)]/10 p-4 text-[var(--fg)]">
          <p className="font-medium">
            Critical: {critical.map((c) => c.name).join(", ")}
          </p>
          <p className="text-sm">
            A skid sent now would arrive after they run out. Act immediately.
          </p>
        </div>
      )}
      {sendNow.length > 0 && (
        <div className="rounded-xl border border-[var(--warning)]/20 border-l-4 border-l-[var(--warning)] bg-[var(--warning)]/10 p-4 text-[var(--fg)]">
          <p className="font-medium">
            Send a skid now: {sendNow.map((c) => c.name).join(", ")}
          </p>
          <p className="text-sm">The send-by time has passed or is due.</p>
        </div>
      )}
    </div>
  );
}