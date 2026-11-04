"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginForms() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleLogin}
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-lg shadow-slate-900/5 sm:p-8"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--fg)] mb-1">Sign in</h1>
        <p className="text-sm text-[var(--muted)]">
          Enter your credentials to access your operations dashboard
        </p>
      </div>

      <section className="space-y-5">
        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-[var(--fg)]">
            Email address
          </label>
          <Input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="min-h-12 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-3 text-base text-[var(--fg)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 placeholder:text-[var(--muted)] sm:text-sm"
            aria-describedby="email-helptext"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-[var(--fg)]">
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="min-h-12 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-3 text-base text-[var(--fg)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 placeholder:text-[var(--muted)] sm:text-sm"
            aria-describedby="password-helptext"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="min-h-12 w-full rounded-lg bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[var(--brand-foreground)] shadow-sm transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </section>

      <p className="mt-6 text-sm text-center text-[var(--muted)]">
        Authorized personnel only
      </p>
    </form>
  );
}