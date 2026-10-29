"use client";
import { useState } from "react";
import { TrucksPanel } from "@/features/trucks/TrucksPanel";
import { SkidsPanel } from "@/features/skids/SkidsPanel";

export default function TrucksPage() {
  const [tab, setTab] = useState<"trucks" | "skids">("trucks");
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-black">Fleet</h1>
      <div className="flex border-b">
        <button onClick={() => setTab("trucks")} className={`flex-1 py-2 text-sm font-semibold border-b-2 ${tab === "trucks" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>Trucks</button>
        <button onClick={() => setTab("skids")} className={`flex-1 py-2 text-sm font-semibold border-b-2 ${tab === "skids" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>Skids</button>
      </div>
      {tab === "trucks" ? <TrucksPanel /> : <SkidsPanel />}
    </main>
  );
}
