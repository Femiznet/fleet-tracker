"use client";
import { useCallback, useEffect, useState } from "react";

export type Option = { value: string; label: string };
export type Field = {
  key: string;
  label: string;
  required?: boolean;
  options?: Option[] | (() => Promise<Option[]>);
};
export type Item = { id: string; primary: string; secondary?: string };
export type RegistryConfig = {
  title: string;
  fields: Field[];
  load: () => Promise<Item[]>;
  add: (v: Record<string, string>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export function SimpleRegistry({ config }: { config: RegistryConfig }) {
  const [items, setItems] = useState<Item[]>([]);
  const [opts, setOpts] = useState<Record<string, Option[]>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await config.load());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [config]);

  useEffect(() => {
    refresh();
    config.fields.forEach(async (f) => {
      if (!f.options) return;
      const o = typeof f.options === "function" ? await f.options() : f.options;
      setOpts((p) => ({ ...p, [f.key]: o }));
    });
  }, [config, refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await config.add(values);
      setValues({});
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this record?")) return;
    setError("");
    try {
      await config.remove(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="bg-white rounded-2xl border p-4 space-y-3">
      <h2 className="font-bold">
        {config.title} <span className="text-slate-400 text-sm">({items.length})</span>
      </h2>

      <form onSubmit={submit} className="flex flex-wrap gap-2">
        {config.fields.map((f) =>
          f.options ? (
            <select
              key={f.key}
              required={f.required}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="border rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">{f.label}…</option>
              {(opts[f.key] ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              key={f.key}
              required={f.required}
              placeholder={f.label}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="border rounded-lg px-2 py-1.5 text-sm"
            />
          )
        )}
        <button disabled={busy} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg">
          Add
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} className="py-2 flex justify-between text-sm">
            <span>
              <strong>{i.primary}</strong>
              {i.secondary && <span className="text-slate-500"> · {i.secondary}</span>}
            </span>
            <button onClick={() => del(i.id)} className="text-red-500">Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}