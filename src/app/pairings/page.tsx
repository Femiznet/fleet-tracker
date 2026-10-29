"use client";
import { SimpleRegistry, type RegistryConfig } from "@/components/SimpleRegistry";
import {
  addCrewPair, addTruckAssignment, listCrewPairs, listDriverOptions,
  listMotormateOptions, listTruckAssignments, listTruckOptions,
  removeCrewPair, removeTruckAssignment,
} from "@/features/pairings/service";

const crewPairs: RegistryConfig = {
  title: "Driver ↔ Motormate",
  fields: [
    { key: "driver", label: "Driver", required: true, options: listDriverOptions },
    { key: "mate", label: "Motormate", required: false, options: listMotormateOptions },
  ],
  load: async () =>
    (await listCrewPairs()).map((p) => ({ id: p.id, primary: p.driver, secondary: p.motormate })),
  add: (v) => addCrewPair(v.driver, v.mate),
  remove: removeCrewPair,
};

const truckAssignments: RegistryConfig = {
  title: "Driver ↔ Truck",
  fields: [
    { key: "driver", label: "Driver", required: true, options: listDriverOptions },
    { key: "truck", label: "Truck", required: false, options: listTruckOptions },
  ],
  load: async () =>
    (await listTruckAssignments()).map((a) => ({ id: a.id, primary: a.plate, secondary: a.driver })),
  add: (v) => addTruckAssignment(v.driver, v.truck),
  remove: removeTruckAssignment,
};

export default function PairingsPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-black">Crew & Truck Pairings</h1>
      {[crewPairs, truckAssignments].map((c) => (
        <SimpleRegistry key={c.title} config={c} />
      ))}
    </main>
  );
}