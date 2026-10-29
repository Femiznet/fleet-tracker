import { TrucksPanel } from "@/features/trucks/TrucksPanel";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-black">Trucks</h1>
      <TrucksPanel />
    </main>
  );
}