"use client";

import { Inter } from "next/font/google";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const plex = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.SubmitEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <main className={`${plex.className} min-h-screen bg-[var(--bg)] text-[var(--fg)]`}>
      <div className="px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[var(--fg)] mb-1">
              Sign in
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Enter your credentials to access your operations dashboard
            </p>
          </div>

          <section
            className="rounded-2xl border border-[var(--border)] border-l-4 border-[var(--brand)] bg-[var(--card)] p-6 sm:p-8"
          >
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--fg)]">
                  Email address
                </label>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)/20] placeholder:text-[var(--muted)]"
                  aria-describedby="email-helptext"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--fg)]">
                  Password
                </label>
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)/20] placeholder:text-[var(--muted)]"
                  aria-describedby="password-helptext"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-[var(--destructive)/20] bg-[var(--destructive)/10] px-4 py-3 text-sm text-[var(--destructive)]">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full border border-[var(--brand)] px-4 py-3 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand)/10] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </section>

          <p className="mt-6 text-sm text-center text-[var(--muted)]">
            Authorized personnel only
          </p>
        </div>
      </div>
    </main>
  );
}
