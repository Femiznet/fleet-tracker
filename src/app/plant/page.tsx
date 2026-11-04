import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import PlantCardDialog from "./PlantCardDialog";
import {
  hookSkid,
  recordArrival,
  recordDispatch,
  registerSkids,
  registerTrucks,
  setGasState,
  setMaintenance,
  unhookSkid,
} from "./actions";


export const instant = false;

type Gas = "empty" | "loading" | "loaded";

type Truck = {
  id: string;
  plate_number: string;
  plate_key: string;
  in_plant: boolean;
  status: "active" | "maintenance";
  customer_id: string | null;
  state_since: string;
  active: boolean;
};

type Skid = {
  id: string;
  skid_number: string;
  skid_key: string;
  truck_id: string | null;
  in_plant: boolean;
  status: "active" | "maintenance";
  gas_state: Gas;
  customer_id: string | null;
  state_since: string;
  active: boolean;
};

type Customer = { id: string; name: string };

type PlantEvent = {
  occurred_at: string;
  event: string;
  truck_id: string | null;
  skid_id: string | null;
  customer_id: string | null;
  gas_state: Gas | null;
  note: string | null;
};

type Ctx = {
  q: string;
  open: string;
  nowInput: string;
  customers: Customer[];
  customerName: (id: string | null) => string;
  allTrucks: Truck[];
  allSkids: Skid[];
  skidByTruck: Map<string, Skid>;
  truckById: Map<string, Truck>;
  history: (kind: "truck" | "skid", id: string) => string[];
};

function ago(iso: string, now?: number) {
  const m = Math.max(1, Math.round((now ?? Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  return `${Math.round(h / 24)} days`;
}

const GAS_LABEL: Record<Gas, string> = { empty: "Empty", loading: "Loading", loaded: "Loaded" };

const btn = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-foreground)] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";
const btnLight = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--fg)] transition hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";
const field = "mt-1 min-h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-base text-[var(--fg)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 sm:text-sm";

function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function History({ lines }: { lines: string[] }) {
  return (
    <div className="border-t border-[var(--border)] pt-3">
      <p className="text-xs font-medium text-[var(--muted)]">Recent history</p>
      {lines.length === 0 ? (
        <p className="mt-1 text-xs text-[var(--muted)]">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs text-[var(--fg)]">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MaintenanceForm({ kind, id, status, inPlant, q }: { kind: "truck" | "skid"; id: string; status: string; inPlant: boolean; q: string }) {
  if (!inPlant) {
    <p className="text-xs text-[var(--muted)]">Record the arrival before changing maintenance.</p>
  }
  const inMaint = status === "maintenance";
  return (
    <form action={setMaintenance} className="flex flex-wrap items-end gap-2">
      <Hidden name="kind" value={kind} />
      <Hidden name="id" value={id} />
      <Hidden name="on" value={inMaint ? "0" : "1"} />
      <Hidden name="q" value={q} />
      <div className="min-w-[10rem] flex-1">
        <Field label={inMaint ? "Note (optional)" : "Reason (optional)"}>
          <input name="note" className={field} />
        </Field>
      </div>
      <button type="submit" className={btnLight}>
        {inMaint ? "Back in service" : "Send to maintenance"}
      </button>
    </form>
  );
}

function GasSelect({ defaultValue }: { defaultValue: Gas }) {
  return (
    <select name="gas" defaultValue={defaultValue} className={field}>
      {(Object.keys(GAS_LABEL) as Gas[]).map((g) => (
        <option key={g} value={g}>
          {GAS_LABEL[g]}
        </option>
      ))}
    </select>
  );
}

function TruckCard({ t, c }: { t: Truck; c: Ctx }) {
  const skid = c.skidByTruck.get(t.id);
  const where = t.in_plant ? "In plant" : `Out of plant${t.customer_id ? `, at ${c.customerName(t.customer_id)}` : ""}`;

  const returnable = c.allSkids.filter(
    (s) => s.active && !s.in_plant && (!s.truck_id || s.truck_id === t.id)
  );
  const sendable = c.allSkids.filter(
    (s) =>
      s.active && s.in_plant && s.status === "active" && s.gas_state === "loaded" && (!s.truck_id || s.truck_id === t.id)
  );
  const loose = c.allSkids.filter((s) => s.active && s.in_plant && s.status === "active" && !s.truck_id);

  return (
    <PlantCardDialog
      title={`Truck ${t.plate_number}${skid ? ` + skid ${skid.skid_number}` : ""}`}
      subtitle={`${where} for ${ago(t.state_since)}`}
      detail={skid ? `Carrying skid ${skid.skid_number} (${GAS_LABEL[skid.gas_state].toLowerCase()})` : "No skid hooked"}
      open={c.open === `truck:${t.id}`}
      badges={[
        ...(t.status === "maintenance" ? ["In maintenance"] : []),
        ...(!t.active ? ["Not in fleet"] : []),
      ]}
    >

      <div className="space-y-5 border-t border-[var(--border)] p-4 sm:p-5">
        {!t.in_plant ? (
          <form action={recordArrival} className="space-y-3">
            <h3 className="font-medium">Record arrival</h3>
            <Hidden name="truck" value={t.id} />
            <Hidden name="q" value={c.q} />
            <Field label="Skid that came back with it">
              <select name="skid" defaultValue={skid?.id ?? ""} className={field}>
                <option value="">No skid</option>
                {returnable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.skid_number}
                    {s.customer_id ? ` (at ${c.customerName(s.customer_id)})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Skid status on arrival">
              <GasSelect defaultValue="empty" />
            </Field>
            <Field label="Arrived at">
              <input type="datetime-local" name="at" defaultValue={c.nowInput} className={field} />
            </Field>
            <Field label="Note (optional)">
              <input name="note" className={field} />
            </Field>
            <button type="submit" className={btn}>
              Record arrival
            </button>
            {skid && (
              <p className="text-xs text-[var(--muted)]">
                If the truck came back with a different skid, choose it above. Skid {skid.skid_number} will stay at{" "}
                {c.customerName(t.customer_id)}.
              </p>
            )}
          </form>
        ) : t.status === "maintenance" ? (
          <p className="text-sm text-[var(--fg)]">This truck is in maintenance, so it can&apos;t be hooked or dispatched.</p>
        ) : sendable.length === 0 ? (
          <p className="text-sm text-[var(--fg)]">
            Nothing to dispatch: this truck needs a loaded, active skid in the plant.
          </p>
        ) : (
          <form action={recordDispatch} className="space-y-3">
            <h3 className="font-medium">Record dispatch</h3>
            <Hidden name="truck" value={t.id} />
            <Hidden name="q" value={c.q} />
            <Field label="Customer">
              <select name="customer" required defaultValue="" className={field}>
                <option value="" disabled>
                  Choose a customer
                </option>
                {c.customers.map((cu) => (
                  <option key={cu.id} value={cu.id}>
                    {cu.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Skid">
              <select name="skid" defaultValue={skid && sendable.some((s) => s.id === skid.id) ? skid.id : ""} required className={field}>
                <option value="" disabled>
                  Choose a loaded skid
                </option>
                {sendable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.skid_number}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Left at">
              <input type="datetime-local" name="at" defaultValue={c.nowInput} className={field} />
            </Field>
            <Field label="Note (optional)">
              <input name="note" className={field} />
            </Field>
            <button type="submit" className={btn}>
              Record dispatch
            </button>
          </form>
        )}

        {t.in_plant && (
          <div className="space-y-2">
            <h3 className="font-medium">Skid hook</h3>
            {skid ? (
              <form action={unhookSkid}>
                <Hidden name="id" value={skid.id} />
                <Hidden name="q" value={c.q} />
                <button type="submit" className={btnLight}>
                  Unhook skid {skid.skid_number}
                </button>
              </form>
            ) : loose.length === 0 || t.status === "maintenance" ? (
              <p className="text-xs text-[var(--muted)]">No loose skid available to hook.</p>
            ) : (
              <form action={hookSkid} className="flex gap-2">
                <Hidden name="truck" value={t.id} />
                <Hidden name="open" value={`truck:${t.id}`} />
                <Hidden name="q" value={c.q} />
                <select name="skid" defaultValue="" aria-label="Skid to hook" className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm">
                  <option value="" disabled>
                    Choose a skid
                  </option>
                  {loose.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.skid_number} ({GAS_LABEL[s.gas_state].toLowerCase()})
                    </option>
                  ))}
                </select>
                <button type="submit" className={btnLight}>
                  Hook
                </button>
              </form>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="font-medium">Maintenance</h3>
          <MaintenanceForm kind="truck" id={t.id} status={t.status} inPlant={t.in_plant} q={c.q} />
        </div>

        <History lines={c.history("truck", t.id)} />
      </div>
    </PlantCardDialog>
  );
}

function SkidCard({ s, c }: { s: Skid; c: Ctx }) {
  const truck = s.truck_id ? c.truckById.get(s.truck_id) : undefined;
  const where = s.in_plant ? "In plant" : `Out of plant${s.customer_id ? `, at ${c.customerName(s.customer_id)}` : ""}`;

  const outTrucks = c.allTrucks.filter((t) => t.active && !t.in_plant);
  const freeTrucks = c.allTrucks.filter(
    (t) => t.active && t.in_plant && t.status === "active" && !c.skidByTruck.has(t.id)
  );

  return (
    <PlantCardDialog
      title={`Skid ${s.skid_number} (${GAS_LABEL[s.gas_state].toLowerCase()})`}
      subtitle={`${where} for ${ago(s.state_since)}`}
      detail={truck ? `Hooked to truck ${truck.plate_number}` : "No truck"}
      open={c.open === `skid:${s.id}`}
      badges={[
        ...(s.status === "maintenance" ? ["In maintenance"] : []),
        ...(!s.active ? ["Not in fleet"] : []),
      ]}
    >

      <div className="space-y-5 border-t border-[var(--border)] p-4 sm:p-5">
        {!s.in_plant ? (
          <form action={recordArrival} className="space-y-3">
            <h3 className="font-medium">Record arrival</h3>
            <Hidden name="skid" value={s.id} />
            <Hidden name="q" value={c.q} />
            <Field label="Truck that brought it">
              <select name="truck" defaultValue={truck?.id ?? ""} className={field}>
                <option value="">No truck</option>
                {outTrucks.map((t) => {
                  const carried = c.skidByTruck.get(t.id);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.plate_number}
                      {carried && carried.id !== s.id ? ` (left with skid ${carried.skid_number})` : ""}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Skid status on arrival">
              <GasSelect defaultValue="empty" />
            </Field>
            <Field label="Arrived at">
              <input type="datetime-local" name="at" defaultValue={c.nowInput} className={field} />
            </Field>
            <Field label="Note (optional)">
              <input name="note" className={field} />
            </Field>
            <button type="submit" className={btn}>
              Record arrival
            </button>
          </form>
        ) : (
          <div className="space-y-2">
            <h3 className="font-medium">Skid status</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(GAS_LABEL) as Gas[]).map((g) => (
                <form key={g} action={setGasState}>
                  <Hidden name="id" value={s.id} />
                  <Hidden name="state" value={g} />
                  <Hidden name="q" value={c.q} />
                  <button type="submit" aria-pressed={s.gas_state === g} className={s.gas_state === g ? btn : btnLight}>
                    {GAS_LABEL[g]}
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}

        {s.in_plant && (
          <div className="space-y-2">
            <h3 className="font-medium">Truck hook</h3>
            {truck ? (
              <form action={unhookSkid}>
                <Hidden name="id" value={s.id} />
                <Hidden name="q" value={c.q} />
                <button type="submit" className={btnLight}>
                  Unhook from {truck.plate_number}
                </button>
              </form>
            ) : freeTrucks.length === 0 || s.status === "maintenance" ? (
              <p className="text-xs text-[var(--muted)]">No truck available to hook to.</p>
            ) : (
              <form action={hookSkid} className="flex gap-2">
                <Hidden name="skid" value={s.id} />
                <Hidden name="open" value={`skid:${s.id}`} />
                <Hidden name="q" value={c.q} />
                <select name="truck" defaultValue="" aria-label="Truck to hook to" className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm">
                  <option value="" disabled>
                    Choose a truck
                  </option>
                  {freeTrucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.plate_number}
                    </option>
                  ))}
                </select>
                <button type="submit" className={btnLight}>
                  Hook
                </button>
              </form>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="font-medium">Maintenance</h3>
          <MaintenanceForm kind="skid" id={s.id} status={s.status} inPlant={s.in_plant} q={c.q} />
        </div>

        <History lines={c.history("skid", s.id)} />
      </div>
    </PlantCardDialog>
  );
}

function Section({ title, children, count }: { title: string; children: ReactNode; count: number }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">
        {title} ({count})
      </h2>
      {count === 0 ? <p className="text-sm text-[var(--muted)]">None right now.</p> : <div className="grid gap-3 md:grid-cols-2">{children}</div>}
    </section>
  );
}

export default async function PlantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; notice?: string; open?: string }>;
}) {
  await connection();

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const open = sp.open ?? "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [trucksRes, skidsRes, customersRes, eventsRes] = await Promise.all([
    supabaseAdmin.from("trucks").select("*").order("plate_number"),
    supabaseAdmin.from("skids").select("*").order("skid_number"),
    supabaseAdmin.from("customers").select("id, name").eq("active", true).order("name"),
    supabaseAdmin
      .from("plant_events")
      .select("occurred_at, event, truck_id, skid_id, customer_id, gas_state, note")
      .order("occurred_at", { ascending: false })
      .limit(600),
  ]);
  if (trucksRes.error) throw trucksRes.error;
  if (skidsRes.error) throw skidsRes.error;
  if (customersRes.error) throw customersRes.error;

  const allTrucks = (trucksRes.data ?? []) as Truck[];
  const allSkids = (skidsRes.data ?? []) as Skid[];
  const customers = (customersRes.data ?? []) as Customer[];
  const events = (eventsRes.data ?? []) as PlantEvent[];

  const truckById = new Map(allTrucks.map((t) => [t.id, t]));
  const skidById = new Map(allSkids.map((s) => [s.id, s]));
  const customerById = new Map(customers.map((cu) => [cu.id, cu.name]));
  const skidByTruck = new Map(allSkids.filter((s) => s.truck_id).map((s) => [s.truck_id as string, s]));
  const customerName = (id: string | null) => (id ? customerById.get(id) ?? "a customer" : "the customer");

  const describe = (e: PlantEvent) => {
    const plate = e.truck_id ? truckById.get(e.truck_id)?.plate_number ?? "?" : "";
    const skidNo = e.skid_id ? skidById.get(e.skid_id)?.skid_number ?? "?" : "";
    const note = e.note ? ` (${e.note})` : "";
    let what = "";
    switch (e.event) {
      case "arrived":
        what = `Arrived in plant${plate ? `, truck ${plate}` : ""}${skidNo ? `, skid ${skidNo}` : ""}`;
        break;
      case "dispatched":
        what = `Dispatched to ${customerName(e.customer_id)}, truck ${plate} with skid ${skidNo}`;
        break;
      case "hooked":
        what = `Skid ${skidNo} hooked to truck ${plate}`;
        break;
      case "unhooked":
        what = `Skid ${skidNo} unhooked from truck ${plate}`;
        break;
      case "maintenance_start":
        what = `Sent to maintenance`;
        break;
      case "maintenance_end":
        what = `Back in service`;
        break;
      case "gas_state":
        what = `Skid ${skidNo} marked ${e.gas_state ?? ""}`;
        break;
      default:
        what = e.event;
    }
    return `${what}${note}, ${ago(e.occurred_at)} ago`;
  };

  const history = (kind: "truck" | "skid", id: string) =>
    events
      .filter((e) => (kind === "truck" ? e.truck_id === id : e.skid_id === id))
      .slice(0, 6)
      .map(describe);

  const nowInput = new Date()
    .toLocaleString("sv-SE", { timeZone: "Africa/Lagos" })
    .replace(" ", "T")
    .slice(0, 16);

  const c: Ctx = { q, open, nowInput, customers, customerName, allTrucks, allSkids, skidByTruck, truckById, history };

  const trucks = allTrucks.filter((t) => t.active);
  const skids = allSkids.filter((s) => s.active);
  const looseSkids = skids.filter((s) => !s.truck_id);

  const key = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const truckHits = key ? allTrucks.filter((t) => t.plate_key.includes(key)).slice(0, 10) : [];
  const skidHits = key ? allSkids.filter((s) => s.skid_key.includes(key)).slice(0, 10) : [];

  const outTrucks = trucks.filter((t) => !t.in_plant);
  const outSkids = looseSkids.filter((s) => !s.in_plant);
  const maintTrucks = trucks.filter((t) => t.in_plant && t.status === "maintenance");
  const maintSkids = skids.filter((s) => s.in_plant && s.status === "maintenance");
  const readyTrucks = trucks.filter((t) => {
    const s = skidByTruck.get(t.id);
    return t.in_plant && t.status === "active" && s && s.active && s.status === "active" && s.gas_state === "loaded";
  });
  const inPlantTrucks = trucks.filter((t) => t.in_plant && t.status === "active");
  const inPlantSkids = looseSkids.filter((s) => s.in_plant && s.status === "active");

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 text-[var(--fg)] sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      <header className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--brand)]">Fleet operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Plant tracker</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Live locations and readiness for trucks and skids.</p>
          </div>
          <div className="hidden sm:block">
            <a href="#register-assets" className={btnLight}>
              Register equipment
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Ready to dispatch", value: readyTrucks.length, color: "text-[var(--success)]" },
            { label: "Trucks out", value: outTrucks.length, color: "text-[var(--info)]" },
            { label: "Loose skids out", value: outSkids.length, color: "text-[var(--info)]" },
            { label: "In maintenance", value: maintTrucks.length + maintSkids.length, color: "text-[var(--warning)]" },
          ].map((item) => (
            <div key={item.label} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm sm:p-4">
              <p className="text-xs leading-5 text-[var(--muted)] sm:text-sm">{item.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <form action="/plant" method="get" role="search" className="flex w-full max-w-xl gap-2">
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Search a truck plate or skid number"
            aria-label="Search a truck plate or skid number"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-base text-[var(--fg)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 sm:text-sm"
          />
          <button type="submit" className={btn}>
            Search
          </button>
        </form>

        {sp.error && (
          <p role="alert" className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">
            {sp.error}
          </p>
        )}
        {sp.notice && (
          <p role="status" className="rounded-lg border border-[var(--success)]/20 bg-[var(--success)]/10 p-3 text-sm text-[var(--success)]">
            {sp.notice}
          </p>
        )}
      </header>

      {key ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Search results ({truckHits.length + skidHits.length})</h2>
            <a href="/plant" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[var(--brand)] underline underline-offset-4">
              Clear search
            </a>
          </div>
          {truckHits.length + skidHits.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-[var(--fg)]">
              No truck or skid matches &ldquo;{q}&rdquo;.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {truckHits.map((t) => (
                <TruckCard key={t.id} t={t} c={c} />
              ))}
              {skidHits.map((s) => (
                <SkidCard key={s.id} s={s} c={c} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <Section title="Out of plant" count={outTrucks.length + outSkids.length}>
            {outTrucks.map((t) => (
              <TruckCard key={t.id} t={t} c={c} />
            ))}
            {outSkids.map((s) => (
              <SkidCard key={s.id} s={s} c={c} />
            ))}
          </Section>

          <Section title="In maintenance" count={maintTrucks.length + maintSkids.length}>
            {maintTrucks.map((t) => (
              <TruckCard key={t.id} t={t} c={c} />
            ))}
            {maintSkids.map((s) => (
              <SkidCard key={s.id} s={s} c={c} />
            ))}
          </Section>

          <Section title="In plant" count={inPlantTrucks.length + inPlantSkids.length}>
            {inPlantTrucks.map((t) => (
              <TruckCard key={t.id} t={t} c={c} />
            ))}
            {inPlantSkids.map((s) => (
              <SkidCard key={s.id} s={s} c={c} />
            ))}
          </Section>
        </>
      )}

      <details id="register-assets" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Register trucks and skids</summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <form action={registerTrucks} className="space-y-2">
            <label htmlFor="trucks-list" className="block text-sm font-medium">
              Trucks (one plate number per line)
            </label>
            <textarea id="trucks-list" name="list" rows={6} className={`${field} min-h-32 resize-y`} />
            <button type="submit" className={btn}>
              Add trucks
            </button>
          </form>
          <form action={registerSkids} className="space-y-2">
            <label htmlFor="skids-list" className="block text-sm font-medium">
              Skids (one skid number per line)
            </label>
            <textarea id="skids-list" name="list" rows={6} className={`${field} min-h-32 resize-y`} />
            <button type="submit" className={btn}>
              Add skids
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          New trucks and skids start in the plant, active, and empty. Numbers already registered are skipped.
        </p>
      </details>
    </main>
  );
}
