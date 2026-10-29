import { DispatchPanel } from "@/features/dispatch/DispatchPanel";

export default function DispatchPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-black">Dispatch</h1>
      <DispatchPanel />
    </main>
  );
}