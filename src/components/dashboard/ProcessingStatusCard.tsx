"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  triggerProcessing,
  retryFailedUpdates,
  type SaveResult,
} from "@/app/dashboard/actions";

export default function ProcessingStatusCard({
  pending,
  processing,
  failed,
  completed,
}: {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}) {
  const [processResult, processAction, processPending] = useActionState<
    SaveResult,
    FormData
  >(triggerProcessing, null);
  const [retryResult, retryAction, retryPending] = useActionState<
    SaveResult,
    FormData
  >(retryFailedUpdates, null);

  useEffect(() => {
    if (processResult) {
      if (processResult.ok) toast.success(processResult.message);
      else toast.error(processResult.message);
    }
  }, [processResult]);

  useEffect(() => {
    if (retryResult) {
      if (retryResult.ok) toast.success(retryResult.message);
      else toast.error(retryResult.message);
    }
  }, [retryResult]);

  const total = pending + processing + failed + completed;

  return (
    <section className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          WhatsApp processing
        </h2>
        <span className="rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs font-medium text-[var(--brand)]">
          {total} total (24h)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <p className="text-xs font-medium text-[var(--muted)]">Pending</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--warning)]">
            {pending}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <p className="text-xs font-medium text-[var(--muted)]">Processing</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--info)]">
            {processing}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <p className="text-xs font-medium text-[var(--muted)]">Failed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--destructive)]">
            {failed}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
          <p className="text-xs font-medium text-[var(--muted)]">Completed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--success)]">
            {completed}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
        <form action={processAction}>
          <button
            type="submit"
            disabled={processPending || pending === 0}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processPending ? "Processing…" : "Process now"}
          </button>
        </form>
        <form action={retryAction}>
          <button
            type="submit"
            disabled={retryPending || failed === 0}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--fg)] transition hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retryPending ? "Retrying…" : "Retry failed"}
          </button>
        </form>
      </div>
    </section>
  );
}