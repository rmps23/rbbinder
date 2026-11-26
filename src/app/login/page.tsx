"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { accountsEnabledInBrowser, supabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "signin" | "signup" | "forgot";

const input =
  "h-11 w-full rounded-md border border-line bg-ink px-3 text-sm text-t1 outline-none placeholder:text-t3 focus:border-brand-gold";
const primary =
  "h-11 w-full rounded-md bg-brand-gold px-3 font-display text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft disabled:opacity-50";

function Brand() {
  return (
    <>
      <div className="mb-2 flex items-center">
        <h1 className="sr-only">RBBinder</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-horizontal.svg" alt="RBBinder" className="h-20 w-auto" />
      </div>
      <p className="mb-5 text-sm text-t3">Riftbound TCG collection</p>
    </>
  );
}

// Old single-password sign in, for running the app locally without Supabase.
function PasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? "Wrong password");
      setBusy(false);
      return;
    }
    router.push(params.get("next") || "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input autoFocus type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button type="submit" disabled={busy || !password} className={primary}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function AccountForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const callback = (to: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback(next) } });
        if (error) throw error;
        if (data.session) {
          router.push(next);
          router.refresh();
          return;
        }
        setNotice("Almost there: we sent you an email - open the link in it to confirm your account.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/auth/reset") });
        if (error) throw error;
        setNotice("If that email has an account, a link to choose a new password is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
    setBusy(false);
  }

  async function google() {
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next) } });
    if (error) setError(error.message);
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      className={`h-9 flex-1 rounded-md text-sm font-semibold transition ${mode === m ? "bg-brand-gold text-ink" : "text-t2 hover:text-t1"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {mode !== "forgot" && (
        <div className="flex gap-1 rounded-lg border border-line bg-ink p-1">
          {tab("signin", "Sign in")}
          {tab("signup", "Create account")}
        </div>
      )}

      {mode !== "forgot" && (
        <>
          <button
            type="button"
            onClick={google}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-line bg-white text-sm font-semibold text-[#1f1f1f] transition hover:bg-white/90"
          >
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-xs text-t3">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === "forgot" && <p className="text-sm text-t2">Enter your email and we&apos;ll send you a link to choose a new password.</p>}
        <input type="email" autoComplete="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        {mode !== "forgot" && (
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "Password (at least 8 characters)" : "Password"}
            minLength={mode === "signup" ? 8 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        {notice && <p className="rounded-md bg-ok/10 px-3 py-2 text-sm text-ok">{notice}</p>}
        <button type="submit" disabled={busy} className={primary}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
      </form>

      <div className="flex justify-center text-sm">
        {mode === "signin" && (
          <button type="button" onClick={() => switchMode("forgot")} className="text-t3 hover:text-t1">
            Forgot your password?
          </button>
        )}
        {mode === "forgot" && (
          <button type="button" onClick={() => switchMode("signin")} className="text-t3 hover:text-t1">
            ← Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-sm animate-card-in overflow-hidden rounded-2xl border border-line bg-panel p-6">
        <Brand />
        <Suspense fallback={null}>{accountsEnabledInBrowser ? <AccountForm /> : <PasswordForm />}</Suspense>
      </div>
    </div>
  );
}
