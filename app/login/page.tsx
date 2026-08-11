"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirectTo");
  // Only allow a same-app path: must start with a single "/" (not "//",
  // which browsers treat as protocol-relative and would send the user off
  // this domain after logging in). Anything else falls back to "/".
  const redirectTo =
    rawRedirect && /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : "/";

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
          <span className="brand-orb w-6 h-6 rounded-full shrink-0" />
          <span className="font-display font-medium text-xl tracking-tight">
            Trade journal
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-6"
        >
          <h1 className="font-display text-lg font-medium mb-1">Sign in</h1>
          <p className="text-ink-secondary text-sm mb-6">
            This journal is private — sign in to continue.
          </p>

          <label className="block mb-4">
            <span className="text-xs text-ink-secondary">Email</span>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full"
            />
          </label>

          <label className="block mb-2">
            <span className="text-xs text-ink-secondary">Password</span>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full"
            />
          </label>

          {error && (
            <p className="text-loss text-xs mt-3" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="mt-6 w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
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
