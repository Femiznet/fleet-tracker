import { TripsPanel } from "@/features/trips/TripsPanel";

export default function TripsPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-black">Trips</h1>
      <TripsPanel />
    </main>
  );
}
