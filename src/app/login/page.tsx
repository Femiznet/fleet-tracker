"use client";

import { Inter } from "next/font/google";
import LoginForms from "./LoginForms";

const plex = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

export default function LoginPage() {
  return (
    <main className={`${plex.className} grid min-h-[calc(100svh-1rem)] place-items-center px-4 py-10 text-[var(--fg)] sm:px-6`}>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--brand)] text-xl font-bold text-white shadow-sm">
            G
          </div>
          <p className="mt-3 text-sm font-semibold tracking-[0.2em] text-[var(--muted)]">GASTECH OPERATIONS</p>
        </div>
        <LoginForms />
      </div>
    </main>
  );
}
