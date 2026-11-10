"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Wrong password");
        setBusy(false);
        return;
      }
      const next = params.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-sm animate-card-in overflow-hidden rounded-2xl border border-line bg-panel p-6 "
      >
        <div className="mb-1 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
          <h1 className="font-logo text-xl font-medium uppercase tracking-[0.25em] text-t1">
            <b className="font-bold text-brand-gold">RB</b>Binder
          </h1>
        </div>
        <p className="mb-5 text-sm text-t3">Riftbound TCG collection</p>
        <input
          autoFocus
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-md border border-line bg-ink px-3 py-2 text-t1 outline-none focus:border-brand-gold"
        />
        {error && <p className="mb-3 text-sm text-bad">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full rounded-md bg-brand-gold px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft disabled:opacity-50"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
