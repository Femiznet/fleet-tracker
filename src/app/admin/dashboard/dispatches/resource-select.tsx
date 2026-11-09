"use client";

import { useEffect, useState } from "react";

interface ResourceOption {
  value: string;
  label: string;
  detail: string;
}

export default function DispatchResourceSelect({
  name,
  id,
  resource,
  label,
  initialValue = "",
  initialLabel = "",
  disabled = false,
}: {
  name: string;
  id?: string;
  resource: "vehicle" | "station";
  label: string;
  initialValue?: string;
  initialLabel?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [query, setQuery] = useState(initialLabel);
  const [options, setOptions] = useState<ResourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputId = id ?? `${name}-${resource}-${initialValue || "new"}`;

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ kind: resource, q: query });
        if (resource === "vehicle" && initialValue) params.set("include", initialValue);
        const response = await fetch(`/api/admin/dispatch-options?${params}`, {
          signal: controller.signal,
        });
        const result: { options?: ResourceOption[]; error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load options.");
        setOptions(result.options ?? []);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        console.error(`Could not load ${resource} options:`, fetchError);
        setError(fetchError instanceof Error ? fetchError.message : "Could not load options.");
        setOptions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [initialValue, query, resource]);

  function choose(option: ResourceOption) {
    setValue(option.value);
    setQuery(option.label);
    setOptions([]);
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">{label}</label>
      <input type="hidden" name={name} value={value} />
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={options.length > 0}
        aria-controls={`${inputId}-options`}
        autoComplete="off"
        value={query}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value);
          setValue("");
        }}
        placeholder={resource === "vehicle" ? "Search plate number…" : "Search customer station…"}
        className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60"
      />
      {!value && query && (
        <div id={`${inputId}-options`} role="listbox" className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p role="status" className="px-3 py-2 text-sm text-slate-500">Searching…</p>
          ) : error ? (
            <p role="alert" className="px-3 py-2 text-sm text-red-700">{error}</p>
          ) : options.length ? (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                onClick={() => choose(option)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium">{option.label}</span>
                {option.detail && <span className="truncate text-xs text-slate-500">{option.detail}</span>}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500">No matching {resource === "vehicle" ? "vehicles" : "stations"}.</p>
          )}
        </div>
      )}
      {!value && !query && <p className="text-xs text-slate-500">Type to search and select a result.</p>}
      {value && (
        <button type="button" disabled={disabled} onClick={() => { setValue(""); setQuery(""); }} className="text-xs font-medium text-emerald-800 hover:underline disabled:opacity-50">
          Change selection
        </button>
      )}
    </div>
  );
}
