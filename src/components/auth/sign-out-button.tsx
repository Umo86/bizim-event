"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/auth-client";

/** Log out from the account page — the header hides its log-out link on small screens. */
export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
