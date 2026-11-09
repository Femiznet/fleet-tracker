"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function RealtimeRefresh({
  table,
  intervalMs = 60_000,
}: {
  table: "vehicle_tracking";
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    let timeoutId: number | undefined;
    const refresh = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase
      .channel(`refresh-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, refresh)
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Realtime refresh subscription for ${table} ${status.toLowerCase()}.`);
        }
      });

    const intervalId = window.setInterval(refresh, intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [intervalMs, router, table]);

  return null;
}
