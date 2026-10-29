"use client";
import { SimpleRegistry, type RegistryConfig } from "@/components/SimpleRegistry";
import { addLocation, listLocations, removeLocation } from "@/features/locations/service";

const locations: RegistryConfig = {
  title: "Locations (customers / stations)",
  fields: [
    { key: "name", label: "Name", required: true },
    {
      key: "type",
      label: "Type",
      required: true,
      options: [
        { value: "customer", label: "Customer" },
        { value: "station", label: "Station" },
      ],
    },
  ],
  load: async () => (await listLocations()).map((l) => ({ id: l.id, primary: l.name, secondary: l.type })),
  add: (v) => addLocation(v.name.trim(), v.type),
  remove: removeLocation,
};

export default function RegistryPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-black">Registry</h1>
      <SimpleRegistry config={locations} />
    </main>
  );
}