"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// The password-reset email lands here (signed in by /auth/callback).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-sm animate-card-in flex-col gap-3 rounded-2xl border border-line bg-panel p-6">
        <h1 className="font-display text-xl font-semibold uppercase tracking-wide text-t1">Choose a new password</h1>
        <input
          autoFocus
          type="password"
          autoComplete="new-password"
          placeholder="New password (at least 8 characters)"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 w-full rounded-md border border-line bg-ink px-3 text-sm text-t1 outline-none placeholder:text-t3 focus:border-brand-gold"
        />
        {error && <p className="text-sm text-bad">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-md bg-brand-gold px-3 font-display text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
