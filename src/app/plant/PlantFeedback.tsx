"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function PlantFeedback({ error, notice }: { error?: string; notice?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(Boolean(error || notice));

  useEffect(() => {
    if (!error && !notice) return;
    const timer = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  useEffect(() => {
    if (visible || (!error && !notice)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("error");
    next.delete("notice");
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [visible, error, notice, pathname, router, searchParams]);

  if (!visible || (!error && !notice)) return null;
  return (
    <div role={error ? "alert" : "status"} className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${error ? "border-[var(--destructive)]/20 bg-[var(--destructive)]/10 text-[var(--destructive)]" : "border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]"}`}>
      <span>{error ?? notice}</span>
      <button type="button" onClick={() => setVisible(false)} className="font-semibold underline underline-offset-2">Dismiss</button>
    </div>
  );
}
