import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const cols: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: t("about"),
      links: [
        { href: "/about", label: t("about") },
        { href: "/how-it-works", label: t("howItWorks") },
        { href: "/blog", label: t("blog") },
        { href: "/contact", label: t("contact") },
      ],
    },
    {
      title: t("forBusinesses"),
      links: [
        { href: "/list-your-business", label: t("forBusinesses") },
        { href: "/pricing", label: t("pricing") },
        { href: "/help", label: t("help") },
      ],
    },
    {
      title: t("terms"),
      links: [
        { href: "/legal/terms", label: t("terms") },
        { href: "/legal/privacy", label: t("privacy") },
        { href: "/legal/cookies", label: t("cookies") },
      ],
    },
  ];
  return (
    <footer className="mt-24 border-t border-line bg-section">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{t("tagline")}</p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-bold text-ink">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line py-6 text-center text-xs text-muted">
        © Bizim Event. {t("rights")}
      </div>
    </footer>
  );
}
