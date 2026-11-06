"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function PlantFeedback({ error, notice }: { error?: string; notice?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (error) {
      toast.error(error);
    } else if (notice) {
      toast.success(notice);
    }
  }, [error, notice]);

  useEffect(() => {
    if (!error && !notice) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("error");
      next.delete("notice");
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [error, notice, pathname, router, searchParams]);

  return null;
}