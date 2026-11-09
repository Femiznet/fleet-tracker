"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Fuel } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("Choose a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("The passwords do not match.");
      return;
    }

    setPending(true);
    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setPending(false);
      return;
    }

    toast.success("Your password has been set.");
    router.replace(data.user.role === 'admin' ? "/admin/dashboard" : "/customer/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div>
          <span className="mb-5 grid size-11 place-items-center rounded-xl bg-slate-950 text-emerald-300">
            <Fuel aria-hidden="true" className="size-5" />
          </span>
          <p className="text-sm font-semibold text-emerald-800">Customer account setup</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set your password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose a password to finish setting up your customer account.
          </p>
        </div>

        <label className="block space-y-2 text-sm font-medium">
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
          />
        </label>

        <label className="block space-y-2 text-sm font-medium">
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-lg bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
        >
          {pending ? "Saving password..." : "Set password"}
        </button>
      </form>
    </main>
  );
}
