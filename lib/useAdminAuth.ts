"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, adminSupabase } from "./supabase";

const NOT_CONFIGURED_ERROR =
  "Sign-in isn't set up yet — Supabase isn't configured (copy .env.local.example to .env.local and fill in your project's values).";

// The admin console's own session, entirely separate from useAuth's
// (different Supabase client, different localStorage key — see
// lib/supabase.ts's adminSupabase). Signing in here as the admin operator
// no longer shows up as a signed-in visitor on the public map, and
// signing out of one no longer signs out the other — they used to share
// one session because both called the same client under the hood.
//
// Password sign-in keyed by a plain ID (an email-shaped string in
// auth.users, but never actually emailed anything — email_confirm is set
// true at creation time so no delivery/verification step exists), not a
// phone number. The account itself is created out-of-band via
// scripts/create-admin.mjs (service-role only — see that script and the
// `admins` table's RLS), never by self-signup here.
export function useAdminAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    adminSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = adminSupabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithPassword = useCallback(async (id: string, password: string) => {
    if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED_ERROR };
    const trimmed = id.trim();
    if (!trimmed || !password) return { error: "Enter your admin ID and password." };
    const { error } = await adminSupabase.auth.signInWithPassword({ email: trimmed, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    await adminSupabase.auth.signOut();
  }, []);

  return { session, loading, signInWithPassword, signOut };
}
