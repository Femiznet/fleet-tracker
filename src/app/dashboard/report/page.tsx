"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

type PrmsReading = {
  id: number;
  name: string;
  flowRate: string;
  totalFlow: string;
  outletPressure: string;
  outletTemperature: string;
};

type SkidReading = {
  id: number;
  identifier: string;
  pressure: string;
  temperature: string;
};

type InventoryField =
  | "standbySkids"
  | "emptySkids"
  | "availableTrucks";

const emptyPrms = (id: number): PrmsReading => ({
  id,
  name: "",
  flowRate: "",
  totalFlow: "",
  outletPressure: "",
  outletTemperature: "",
});

const emptySkid = (id: number): SkidReading => ({
  id,
  identifier: "",
  pressure: "",
  temperature: "",
});

function hasDuplicates(values: string[]) {
  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return new Set(normalized).size !== normalized.length;
}

export default function ReportPage() {
  const router = useRouter();

  const inventoryInputRefs = useRef<
    Record<string, HTMLInputElement | null>
  >({});

  const [prmsUnits, setPrmsUnits] = useState<PrmsReading[]>([
    emptyPrms(1),
  ]);

  const [skids, setSkids] = useState<SkidReading[]>([
    emptySkid(1),
  ]);

  const [station, setStation] = useState({
    standbySkids: [""],
    emptySkids: [""],
    landingGearBoxes: "",
    availableTrucks: [""],
  });

  const [loading, setLoading] = useState(false);

  function updatePrms(
    id: number,
    field: keyof PrmsReading,
    value: string
  ) {
    setPrmsUnits((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function updateSkid(
    id: number,
    field: keyof SkidReading,
    value: string
  ) {
    setSkids((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function updateInventory(
    field: InventoryField,
    index: number,
    value: string
  ) {
    setStation((current) => ({
      ...current,
      [field]: current[field].map((item, i) =>
        i === index ? value : item
      ),
    }));
  }

  function addInventory(field: InventoryField) {
    const nextIndex = station[field].length;
    const inputKey = `${field}-${nextIndex}`;

    setStation((current) => ({
      ...current,
      [field]: [...current[field], ""],
    }));

    requestAnimationFrame(() => {
      inventoryInputRefs.current[inputKey]?.focus();
    });
  }

  function removeInventory(field: InventoryField, index: number) {
    setStation((current) => ({
      ...current,
      [field]: current[field].filter((_, i) => i !== index),
    }));
  }

  function addPrms() {
    setPrmsUnits((current) => [
      ...current,
      emptyPrms(Date.now()),
    ]);
  }

  function addSkid() {
    setSkids((current) => [
      ...current,
      emptySkid(Date.now()),
    ]);
  }

  function input(
    label: string,
    value: string,
    onChange: (value: string) => void,
    unit?: string
  ) {
    return (
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">
          {label}{" "}
          {unit && (
            <span className="opacity-60">({unit})</span>
          )}
        </span>

        <input
          type="number"
          step="any"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent p-2.5"
        />
      </label>
    );
  }

  function inventoryList(
    title: string,
    field: InventoryField,
    placeholder: string
  ) {
    const values = station[field];

    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{title}</h3>

        {values.map((value, index) => {
          const inputKey = `${field}-${index}`;

          return (
            <div key={inputKey} className="relative">
              <input
                ref={(element) => {
                  inventoryInputRefs.current[inputKey] = element;
                }}
                value={value}
                onChange={(e) =>
                  updateInventory(field, index, e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();

                    if (value.trim()) {
                      addInventory(field);
                    }
                  }
                }}
                placeholder={placeholder}
                className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2.5 pl-3 pr-11 text-sm"
              />

              {values.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInventory(field, index)}
                  aria-label={`Remove ${title} entry`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-sm text-red-500 hover:bg-red-500/10"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (prmsUnits.some((item) => !item.name.trim())) {
      toast.error("Enter a name for every PRMS.");
      return;
    }

    if (skids.some((item) => !item.identifier.trim())) {
      toast.error("Enter an identifier for every skid.");
      return;
    }

    if (hasDuplicates(prmsUnits.map((item) => item.name))) {
      toast.error("Duplicate PRMS names are not allowed.");
      return;
    }

    if (hasDuplicates(skids.map((item) => item.identifier))) {
      toast.error("Duplicate skid identifiers are not allowed.");
      return;
    }

    for (const field of [
      "standbySkids",
      "emptySkids",
      "availableTrucks",
    ] as InventoryField[]) {
      if (hasDuplicates(station[field])) {
        toast.error("Duplicate inventory entries are not allowed.");
        return;
      }
    }

    setLoading(true);

    try {
      const { error } = await supabase.rpc(
        "submit_station_report",
        {
          p_reported_at: new Date().toISOString(),

          p_standby_skids: station.standbySkids
            .map((value) => value.trim())
            .filter(Boolean),

          p_empty_skids: station.emptySkids
            .map((value) => value.trim())
            .filter(Boolean),

          p_landing_gear_boxes:
            station.landingGearBoxes === ""
              ? 0
              : Number(station.landingGearBoxes),

          p_available_trucks: station.availableTrucks
            .map((value) => value.trim())
            .filter(Boolean),

          p_prms_readings: prmsUnits.map((item) => ({
            prms_name: item.name.trim(),
            flow_rate:
              item.flowRate === "" ? null : Number(item.flowRate),
            total_flow:
              item.totalFlow === "" ? null : Number(item.totalFlow),
            outlet_pressure:
              item.outletPressure === ""
                ? null
                : Number(item.outletPressure),
            outlet_temperature:
              item.outletTemperature === ""
                ? null
                : Number(item.outletTemperature),
          })),

          p_skid_readings: skids.map((item) => ({
            skid_identifier: item.identifier.trim(),
            pressure:
              item.pressure === "" ? null : Number(item.pressure),
            temperature:
              item.temperature === ""
                ? null
                : Number(item.temperature),
          })),
        }
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Station report submitted successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong while submitting.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-bold">Station Report</h1>
        <p className="mt-1 text-sm opacity-70">
          {"Submit your station's operational readings."}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* PRMS readings */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">PRMS Readings</h2>

          {prmsUnits.map((item, index) => (
            <div
              key={item.id}
              className="space-y-3 rounded-xl border border-[var(--border)] p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  PRMS {index + 1}
                </h3>

                {prmsUnits.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPrmsUnits((current) =>
                        current.filter((unit) => unit.id !== item.id)
                      )
                    }
                    className="text-xs text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">PRMS Name</span>
                <input
                  required
                  value={item.name}
                  onChange={(e) =>
                    updatePrms(item.id, "name", e.target.value)
                  }
                  placeholder="e.g. PRMS 1"
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent p-2.5"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                {input("Flow Rate", item.flowRate, (v) =>
                  updatePrms(item.id, "flowRate", v), "Scm/h")}

                {input("Total Flow", item.totalFlow, (v) =>
                  updatePrms(item.id, "totalFlow", v), "Scm")}

                {input("Outlet Pressure", item.outletPressure, (v) =>
                  updatePrms(item.id, "outletPressure", v), "bar")}

                {input("Outlet Temperature", item.outletTemperature, (v) =>
                  updatePrms(item.id, "outletTemperature", v), "°C")}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addPrms}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            + Add PRMS
          </button>
        </section>

        {/* Skid readings */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Skid Readings</h2>

          {skids.map((item, index) => (
            <div
              key={item.id}
              className="space-y-3 rounded-xl border border-[var(--border)] p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Skid {index + 1}
                </h3>

                {skids.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSkids((current) =>
                        current.filter((skid) => skid.id !== item.id)
                      )
                    }
                    className="text-xs text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Skid Number / Model
                </span>
                <input
                  required
                  value={item.identifier}
                  onChange={(e) =>
                    updateSkid(item.id, "identifier", e.target.value)
                  }
                  placeholder="Enter skid number or model"
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent p-2.5"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                {input("Skid Pressure", item.pressure, (v) =>
                  updateSkid(item.id, "pressure", v), "bar")}

                {input("Skid Temperature", item.temperature, (v) =>
                  updateSkid(item.id, "temperature", v), "°C")}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSkid}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            + Add Skid
          </button>
        </section>

        {/* Station-wide information */}
        <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
          <div>
            <h2 className="text-base font-semibold">
              Station-wide Information
            </h2>
            <p className="mt-1 text-xs opacity-60">
              Enter these values once for the entire station.
            </p>
          </div>

          {inventoryList(
            "Standby Skids",
            "standbySkids",
            "Enter skid model or number"
          )}

          {inventoryList(
            "Empty Skids",
            "emptySkids",
            "Enter skid model or number"
          )}

          {input(
            "Landing Gear Boxes",
            station.landingGearBoxes,
            (value) =>
              setStation((current) => ({
                ...current,
                landingGearBoxes: value,
              }))
          )}

          {inventoryList(
            "Available Trucks",
            "availableTrucks",
            "Enter truck plate number"
          )}
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </main>
  );
}