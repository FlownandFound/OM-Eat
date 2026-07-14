"use client";

import { usePathname, useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  const pathname = usePathname();

  // No session on the login page — a sign-out control there looks live
  // but does nothing.
  if (pathname === "/admin/login") return null;

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
