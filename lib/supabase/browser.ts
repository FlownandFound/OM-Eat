"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client for curator auth only (login and sign-out under /admin).
// Anon key: RLS gives the anon role read-only access, so nothing here can
// write until a curator has actually signed in.

export function createAuthBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
