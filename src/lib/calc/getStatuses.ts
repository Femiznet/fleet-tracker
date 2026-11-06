import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  computeStatus,
  type CustomerStatus,
  type Status,
  type UpdateRow,
} from "./monitor";
import type { Extraction } from "../ai/extractionSchema";

const ORDER: Record<Status, number> = {
  critical: 0,
  send_now: 1,
  soon: 2,
  unknown: 3,
  ok: 4,
};

export async function getCustomerStatuses(): Promise<CustomerStatus[]> {
  // 30 h covers the "same hour yesterday" comparison.
  const since = new Date(Date.now() - 30 * 3600 * 1000).toISOString();

  const [customersRes, updatesRes] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("name, group_name, cutoff_bar, trip_minutes, full_bar")
      .eq("active", true),
    supabaseAdmin
      .from("whatsapp_updates")
      .select("id, group_name, received_at, extracted_data")
      .eq("processing_status", "completed") // needs_review rows are left out for now
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(1000),
  ]);

  if (customersRes.error) throw customersRes.error;
  if (updatesRes.error) throw updatesRes.error;

  const byGroup = new Map<string, UpdateRow[]>();
  // Track groups that don't have a customer yet
  const unknownGroups = new Set<string>();
  for (const u of updatesRes.data ?? []) {
    if (!u.group_name || !u.extracted_data) continue;
    const list = byGroup.get(u.group_name) ?? [];
    list.push({
      id: u.id,
      received_at: u.received_at,
      data: u.extracted_data as Extraction,
    });
    byGroup.set(u.group_name, list);

    // Check if this group_name exists as a customer
    const customerExists = customersRes.data?.some(
      (c) => c.group_name && c.group_name.toLowerCase() === u.group_name.toLowerCase()
    );
    if (!customerExists) {
      unknownGroups.add(u.group_name);
    }
  }

  const statuses = (customersRes.data ?? []).map((c) =>
    computeStatus(
      {
        name: c.name,
        cutoff_bar: Number(c.cutoff_bar),
        trip_minutes: c.trip_minutes === null ? null : Number(c.trip_minutes),
        full_bar: Number(c.full_bar),
      },
      byGroup.get(c.group_name) ?? []
    )
  );

  return statuses.sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] ||
      (a.sendBy ?? "9").localeCompare(b.sendBy ?? "9")
  );
}