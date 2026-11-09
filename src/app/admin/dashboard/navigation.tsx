"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import {
  Fuel,
  LayoutDashboard,
  MapPinned,
  Truck,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";
import SignOutButton from "@/components/sign-out-button";

const links = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/dashboard/dispatches", label: "Dispatches", icon: Waypoints },
  { href: "/admin/dashboard/vehicles", label: "Vehicles", icon: Truck },
  { href: "/admin/dashboard/places", label: "Places", icon: MapPinned },
];

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="space-y-1">
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <Icon aria-hidden="true" className="size-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminAppShell({ children }: { children: ReactNode }) {
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <Link href="/admin/dashboard" className="flex h-[4.5rem] items-center gap-3 border-b border-slate-200 px-6">
          <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-emerald-300">
            <Fuel aria-hidden="true" className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight">Fleet Operations</span>
            <span className="block text-xs text-slate-500">CNG logistics</span>
          </span>
        </Link>
        <div className="px-4 py-6">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Workspace
          </p>
          <NavigationLinks />
        </div>
        <div className="mt-auto border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-800">
              <Fuel aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Operations team</span>
              <span className="block text-xs text-slate-500">Administrator</span>
            </span>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8">
            <div className="flex items-center gap-3">
              <Link href="/admin/dashboard" className="flex items-center gap-2 lg:hidden">
                <Fuel aria-hidden="true" className="size-5 text-emerald-700" />
                <span className="text-sm font-semibold">Fleet Ops</span>
              </Link>
              <div className="hidden text-sm text-slate-500 lg:block">Operations workspace</div>
            </div>
            <div className="lg:hidden">
              <SignOutButton />
            </div>
            <details ref={mobileMenuRef} className="relative lg:hidden">
              <summary className="list-none cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                Menu
              </summary>
              <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <NavigationLinks onNavigate={() => {
                  if (mobileMenuRef.current) mobileMenuRef.current.open = false;
                }} />
              </div>
            </details>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
