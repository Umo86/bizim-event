"use client";

import { UserRound } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { buttonVariants } from "@/components/ui/button";

type Labels = { logIn: string; signUp: string; account: string; logOut: string };

/** Client-side so the header stays part of the static shell. */
export function AccountMenu({ labels }: { labels: Labels }) {
  const { data, isPending } = useSession();
  const router = useRouter();

  if (isPending) return <div className="h-11 w-24 animate-pulse rounded-xl bg-section" aria-hidden />;

  if (!data) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {labels.logIn}
        </Link>
        <Link href="/sign-up" className={buttonVariants({ variant: "outline", size: "sm" }) + " hidden sm:inline-flex"}>
          {labels.signUp}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <UserRound className="size-4" aria-hidden />
        <span className="hidden sm:inline">{labels.account}</span>
      </Link>
      <button
        type="button"
        className={buttonVariants({ variant: "link", size: "sm" }) + " hidden md:inline-flex"}
        onClick={async () => {
          await signOut();
          router.refresh();
        }}
      >
        {labels.logOut}
      </button>
    </div>
  );
}
