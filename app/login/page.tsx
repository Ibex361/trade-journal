"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Incorrect email or password.");
      setSubmitting(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <span className="signal-bar h-7" />
          <span className="font-display font-medium text-xl tracking-tight">
            Trade journal
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-1 border border-surface-border rounded-card p-6"
        >
          <h1 className="font-display text-lg font-medium mb-1">Sign in</h1>
          <p className="text-ink-secondary text-sm mb-6">
            This journal is private — sign in to continue.
          </p>

          <label className="block mb-4">
            <span className="text-xs text-ink-secondary">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="block mb-2">
            <span className="text-xs text-ink-secondary">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-sm"
            />
          </label>

          {error && (
            <p className="text-loss text-xs mt-3" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full text-sm bg-brass text-surface-0 font-medium px-4 py-2.5 rounded-full disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
