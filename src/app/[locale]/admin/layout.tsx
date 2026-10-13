import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/server/session";

export const metadata = { robots: { index: false, follow: false } };

/** Admin area: hidden (404) for anyone who isn't an admin. Every admin DAL call re-checks too. */
export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[60vh] max-w-6xl animate-pulse px-4 py-12" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") notFound();
  const t = await getTranslations("admin");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label={t("title")} className="mb-8 flex items-center gap-4 border-b border-line pb-3 text-sm">
        <span className="font-heading font-bold text-ink">{t("title")}</span>
        <Link href="/admin/approvals" className="font-semibold text-primary-strong hover:underline">
          {t("approvals")}
        </Link>
      </nav>
      {children}
    </div>
  );
}
