"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus2, LayoutDashboard } from "lucide-react";

export default function CustomerNavigation({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: "overview" | "report";
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const Icon = icon === "overview" ? LayoutDashboard : FilePlus2;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
