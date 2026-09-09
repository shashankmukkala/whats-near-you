"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { adminSupabase } from "@/lib/supabase";

type AdminStatus = "checking" | "not-admin" | "admin";

// Gated by ID+password sign-in (see lib/useAdminAuth's signInWithPassword)
// plus membership in the `admins` table (0022_admin_role_and_enquiry_access.sql).
// Both checks happen against Postgres, not a client-side flag: `is_admin()`
// is a security-definer RPC evaluated as the signed-in user, so there's
// nothing here a visitor could spoof by editing client state. The account
// itself is never created by this page — see scripts/create-admin.mjs,
// which only the project owner runs (needs the Supabase service role key).
//
// Uses its own Supabase Auth session (lib/useAdminAuth, a separate
// client/localStorage key from the public site's useAuth) — signing in
// here used to share the same session as a Google-signed-in visitor,
// so the admin operator's account started appearing as "signed in" on
// the public map, and signing out of either logged both out.
//
// Shared by every /admin/* route (app/admin/page.tsx, app/admin/users/page.tsx,
// ...) so the login/reset/is_admin-check flow lives in exactly one place —
// each route just wraps its own content in this gate.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { session, loading, signInWithPassword, signOut } = useAdminAuth();
  const [status, setStatus] = useState<AdminStatus>("checking");

  // Reset to "checking" the moment the signed-in identity changes —
  // adjusted during render (React's recommended pattern for state driven
  // by a prop/value) rather than in the effect below, both because the
  // effect can't set state synchronously in its body and because doing
  // it here means a stale "admin"/"not-admin" from a *previous* account
  // never renders even for a frame while the new account's check is
  // still in flight.
  const currentUserId = session?.user.id ?? null;
  const [lastUserId, setLastUserId] = useState(currentUserId);
  if (currentUserId !== lastUserId) {
    setLastUserId(currentUserId);
    setStatus("checking");
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    adminSupabase
      .rpc("is_admin")
      .then(({ data, error }) => {
        if (cancelled) return;
        setStatus(!error && data ? "admin" : "not-admin");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) {
    return <FullPageMessage title="Checking admin access…" />;
  }

  if (!session) {
    return <AdminLoginForm onSubmit={signInWithPassword} />;
  }

  if (status === "checking") {
    return <FullPageMessage title="Checking admin access…" />;
  }

  if (status === "not-admin") {
    return (
      <FullPageMessage title="This account isn't an admin.">
        <p>Signed in as {session?.user.email ?? "an account"} without admin access.</p>
        <button
          onClick={() => signOut()}
          className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
        >
          Sign out and try another account
        </button>
      </FullPageMessage>
    );
  }

  return <>{children}</>;
}

function FullPageMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-dvw items-center justify-center bg-[#0b0b0d] px-4 text-center text-neutral-100">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {children && <div className="mt-2 text-xs text-neutral-400">{children}</div>}
      </div>
    </div>
  );
}

function AdminLoginForm({
  onSubmit,
}: {
  onSubmit: (id: string, password: string) => Promise<{ error: string | null }>;
}) {
  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const idValid = id.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idValid || !password || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await onSubmit(id, password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    // useAdminAuth's session updates via onAuthStateChange and the
    // parent's is_admin effect picks it up on its own — this navigation
    // is just about *where* that lands: always the map (/admin), not
    // whichever /admin/* page happened to be open (e.g. /admin/analytics)
    // when the sign-in form was shown, since a signed-out admin visiting
    // any of those pages sees this same form in place, without a redirect.
    if (pathname !== "/admin") router.replace("/admin");
  }

  if (mode === "reset") {
    return (
      <AdminResetPasswordForm
        initialId={id}
        onDone={(newId) => {
          setId(newId);
          setPassword("");
          setMode("sign-in");
        }}
        onCancel={() => setMode("sign-in")}
      />
    );
  }

  return (
    <div className="flex h-dvh w-dvw items-center justify-center bg-[#0b0b0d] px-4">
      <form
        onSubmit={handleSubmit}
        className="panel-elevated w-full max-w-sm space-y-3 rounded-3xl p-6"
      >
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Admin sign-in</h1>
          <p className="mt-1 text-xs text-neutral-400">Restricted to WhatsNearYou admins.</p>
        </div>

        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Admin ID"
          autoComplete="username"
          autoFocus
          className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-neutral-100 focus:outline-none"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-neutral-100 focus:outline-none"
        />

        {error && <p className="text-[11px] text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!idValid || !password || busy}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => setMode("reset")}
          className="w-full text-center text-[11px] text-neutral-400 hover:underline"
        >
          Forgot password?
        </button>
      </form>
    </div>
  );
}

// Verifies the first-5/last-5 digits of two secret numbers set ahead of
// time (scripts/set-admin-recovery.mjs) against a hash checked entirely
// server-side (app/api/admin/reset-password) — this form never learns
// whether any individual field it submits was right or wrong, only
// whether the full reset succeeded, so it can't be used to narrow down
// the recovery numbers piece by piece.
function AdminResetPasswordForm({
  initialId,
  onDone,
  onCancel,
}: {
  initialId: string;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const [id, setId] = useState(initialId);
  const [num1First5, setNum1First5] = useState("");
  const [num1Last5, setNum1Last5] = useState("");
  const [num2First5, setNum2First5] = useState("");
  const [num2Last5, setNum2Last5] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const digitsValid = (v: string) => /^\d{5}$/.test(v);
  const formValid =
    id.trim().length > 0 &&
    digitsValid(num1First5) &&
    digitsValid(num1Last5) &&
    digitsValid(num2First5) &&
    digitsValid(num2Last5) &&
    newPassword.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), num1First5, num1Last5, num2First5, num2Last5, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't reset the password.");
      onDone(id.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset the password.");
    } finally {
      setBusy(false);
    }
  }

  function digitField(value: string, setValue: (v: string) => void, placeholder: string) {
    return (
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 5))}
        placeholder={placeholder}
        inputMode="numeric"
        className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-center text-sm text-neutral-100 focus:outline-none"
      />
    );
  }

  return (
    <div className="flex h-dvh w-dvw items-center justify-center bg-[#0b0b0d] px-4">
      <form onSubmit={handleSubmit} className="panel-elevated w-full max-w-sm space-y-3 rounded-3xl p-6">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Reset admin password</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Enter the first 5 and last 5 digits of each of your two recovery numbers.
          </p>
        </div>

        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Admin ID"
          autoComplete="username"
          autoFocus
          className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-neutral-100 focus:outline-none"
        />

        <div>
          <p className="mb-1 text-[11px] text-neutral-400">Number 1</p>
          <div className="grid grid-cols-2 gap-2">
            {digitField(num1First5, setNum1First5, "First 5 digits")}
            {digitField(num1Last5, setNum1Last5, "Last 5 digits")}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] text-neutral-400">Number 2</p>
          <div className="grid grid-cols-2 gap-2">
            {digitField(num2First5, setNum2First5, "First 5 digits")}
            {digitField(num2Last5, setNum2Last5, "Last 5 digits")}
          </div>
        </div>

        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min 8 characters)"
          autoComplete="new-password"
          className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-neutral-100 focus:outline-none"
        />

        {error && <p className="text-[11px] text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!formValid || busy}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Resetting…" : "Reset password"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-[11px] text-neutral-400 hover:underline"
        >
          Back to sign in
        </button>
      </form>
    </div>
  );
}
