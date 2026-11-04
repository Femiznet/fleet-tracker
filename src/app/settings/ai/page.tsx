"use client"

import { Inter } from "next/font/google"
import AiForms from "./AiForms"

const plex = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] })

export default function AiSettingsPage() {
  return (
    <main className={`${plex.className} mx-auto max-w-7xl px-4 py-6 text-[var(--fg)] sm:px-6 sm:py-8 lg:px-8`}>
      <header className="mb-6 sm:mb-8">
        <p className="text-sm font-medium text-[var(--brand)]">Integrations</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">AI settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Configure and test the provider used to process incoming updates.
        </p>
      </header>
      <AiForms />
    </main>
  )
}