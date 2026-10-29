"use client";
import { useState } from "react";
import { CrewPanel } from "@/features/crew/CrewPanel";
import type { CrewKind } from "@/features/crew/service";

const tabs: { kind: CrewKind; label: string }[] = [
  { kind: "drivers", label: "Drivers" },
  { kind: "motormates", label: "Motormates" },
  { kind: "managers", label: "Managers" },
];

export default function CrewPage() {
  const [kind, setKind] = useState<CrewKind>("drivers");

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-black">Crew</h1>

      <div className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t.kind}
            onClick={() => setKind(t.kind)}
            className={`flex-1 py-2 text-sm font-semibold border-b-2 ${
              kind === t.kind ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CrewPanel key={kind} kind={kind} />
    </main>
  );
}