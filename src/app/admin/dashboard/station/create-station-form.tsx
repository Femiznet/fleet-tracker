"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCreateStationDraft } from "@/stores/create-station-draft";
import {
  createCustomerStation,
  type CreateStationState,
} from "./actions";

const initialState: CreateStationState = null;

export default function CreateStationForm() {
  const [state, formAction, pending] = useActionState(
    createCustomerStation,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const email = useCreateStationDraft((store) => store.email);
  const name = useCreateStationDraft((store) => store.name);
  const type = useCreateStationDraft((store) => store.type);
  const distance = useCreateStationDraft((store) => store.distance);
  const location = useCreateStationDraft((store) => store.location);
  const setField = useCreateStationDraft((store) => store.setField);
  const clearDraft = useCreateStationDraft((store) => store.clear);

  useEffect(() => {
    void useCreateStationDraft.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (state?.status === "success") {
      clearDraft();
      toast.success(state.message);
    } else if (state?.status === "error") {
      toast.error(state.message);
    }
  }, [clearDraft, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4 rounded-2xl border border-[var(--border)] p-6 sm:grid-cols-2"
    >
      <label className="space-y-2 text-sm font-medium">
        Customer email
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(event) => setField("email", event.target.value)}
          className="w-full rounded-lg border bg-transparent p-3"
          placeholder="customer@example.com"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Station name
        <input
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setField("name", event.target.value)}
          className="w-full rounded-lg border bg-transparent p-3"
          placeholder="Customer station"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Delivery type
        <select
          name="type"
          value={type}
          onChange={(event) => setField("type", event.target.value)}
          className="w-full rounded-lg border bg-background p-3"
        >
          <option value="">Not specified</option>
          <option value="METER">Meter</option>
          <option value="SELF-PICK">Self-pick</option>
          <option value="WAYBILL">Waybill</option>
        </select>
      </label>

      <label className="space-y-2 text-sm font-medium">
        Distance
        <input
          name="distance"
          type="number"
          min="0"
          max="99999999.99"
          step="0.01"
          value={distance}
          onChange={(event) => setField("distance", event.target.value)}
          className="w-full rounded-lg border bg-transparent p-3"
          placeholder="Optional"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Location
        <input
          name="location"
          maxLength={300}
          value={location}
          onChange={(event) => setField("location", event.target.value)}
          className="w-full rounded-lg border bg-transparent p-3"
          placeholder="Optional"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--fg)] p-3 font-semibold text-[var(--bg)] disabled:opacity-50 sm:col-span-2"
      >
        {pending ? "Creating station and sending invite..." : "Create station and invite customer"}
      </button>
    </form>
  );
}
