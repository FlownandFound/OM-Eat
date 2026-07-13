"use client";

import { useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createAuthBrowserClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} className="text-sm underline">
      Sign out
    </button>
  );
}
