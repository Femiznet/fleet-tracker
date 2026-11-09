"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  resendCustomerInvitation,
  type CreateStationState,
} from "./actions";

const initialState: CreateStationState = null;

export default function ResendInvitationButton({
  stationId,
}: {
  stationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    resendCustomerInvitation,
    initialState
  );

  useEffect(() => {
    if (state?.status === "success") {
      toast.success(state.message);
    } else if (state?.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="stationId" value={stationId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Resending invitation..." : "Resend invitation email"}
      </button>
    </form>
  );
}
