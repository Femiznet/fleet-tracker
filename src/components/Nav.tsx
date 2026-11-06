"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/plant", label: "Plant" },
  { href: "/customers", label: "Customers" },
  { href: "/settings/ai", label: "AI settings" },
  { href: "/settings/alerts", label: "Alerts" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]/95 shadow-sm backdrop-blur">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-4 py-3 sm:px-6 lg:px-8"
      >
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 rounded-md text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white"
          >
            G
          </span>
          <span className="font-semibold tracking-[0.16em]">GASTECH</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
                  active
                    ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                    : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--border)] text-lg text-[var(--fg)] transition-colors hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] md:hidden"
          >
            {isMobileMenuOpen ? "×" : "☰"}
          </button>
        </div>

        <div
          id="mobile-navigation"
          className={`${isMobileMenuOpen ? "block border-t border-[var(--border)] pt-3" : "hidden"} w-full md:hidden`}
        >
            <ul className="grid grid-cols-2 gap-2">
              {links.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
                        active
                          ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                          : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
        </div>
      </nav>
    </header>
  );
}
