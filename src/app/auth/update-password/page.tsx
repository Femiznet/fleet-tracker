"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-[var(--border)] p-8 shadow-lg"
      >
        <div>
          <h1 className="text-2xl font-bold">Set your password</h1>
          <p className="mt-2 text-sm opacity-70">
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
            className="w-full rounded-lg border bg-transparent p-3"
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
            className="w-full rounded-lg border bg-transparent p-3"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--fg)] p-3 font-semibold text-[var(--bg)] disabled:opacity-50"
        >
          {pending ? "Saving password..." : "Set password"}
        </button>
      </form>
    </main>
  );
}
