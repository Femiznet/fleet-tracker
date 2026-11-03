"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/settings/ai", label: "AI Settings" },
  { href: "/settings/alerts", label: "Alerts" },
];

export function Nav() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [activeLink, setActiveLink] = React.useState("/");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setActiveLink(window.location.pathname);
    }
  }, []);

  const formattedLinks = links.map((l) => ({
    ...l,
    isActive: l.href === activeLink,
  }));

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <nav
      className="border-b border-[var(--border)] bg-[var(--card)] flex flex-col sm:flex-row items-center justify-between px-4 py-3 sm:py-2"
    >
      <div className="flex items-center gap-3">
        <strong className="tracking-widest text-[var(--fg)]">GASTECH</strong>
      </div>

      <ul className="flex gap-4 sm:gap-0 sm:ml-8 text-[var(--muted)] transition-colors hover:[var(--fg)]">
        {formattedLinks.map((l) => (
          <li key={l.href} className="relative py-2 sm:py-0">
            <Link
              key={l.href}
              href={l.href}
              className={`relative px-3 py-2 rounded-md transition-colors [&.active]:bg-[var(--brand)/20] [&.active]:text-[var(--brand)]`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <button
          onClick={handleLogout}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--border)/5] sm:hidden"
          aria-label="Sign out"
        >
          Sign out
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-lg px-3 py-2 [var(--fg)] transition-colors sm:hidden"
          aria-label="Open menu"
        >
          ☰
        </button>

        <button
          onClick={handleLogout}
          className="hidden sm:flex rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--border)/5]"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="mt-4 sm:mt-0 absolute top-full left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] p-4 w-full sm:w-64">
          <ul className="flex flex-col gap-2">
            {formattedLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="rounded-md py-2 px-3 transition-colors [&.active]:bg-[var(--brand)/20] [&.active]:text-[var(--brand)]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                onClick={handleLogout}
                className="w-full rounded-md border border-[var(--border)] py-2 px-3 text-xs font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--border)/5] text-left"
              >
                Sign out
              </button>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
