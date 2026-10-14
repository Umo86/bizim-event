import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LEGAL_SLUGS, legalDoc, type LegalSlug } from "@/content/legal";
import { RichText } from "./rich-text";

/** A legal document: title, date, summary, contents, then the sections; plain and photo-free. */
export async function LegalDocument({ slug, locale }: { slug: LegalSlug; locale: "tr" | "en" }) {
  const doc = legalDoc(slug, locale);
  const t = await getTranslations({ locale, namespace: "legal" });
  const format = await getFormatter({ locale });
  const updated = format.dateTime(new Date(`${doc.updated}T12:00:00Z`), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const others = LEGAL_SLUGS.filter((s) => s !== slug);

  return (
    <article className="mx-auto max-w-3xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
      <header>
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted">{t("updated", { date: updated })}</p>
        <p className="mt-6 rounded-2xl bg-section p-5 text-lg leading-relaxed text-ink">{doc.summary}</p>
        {locale === "tr" ? <p className="mt-3 text-sm text-muted">{t("translationNote")}</p> : null}
      </header>

      <nav aria-labelledby="contents" className="mt-10 border-y border-line py-6">
        <h2 id="contents" className="text-sm font-bold text-ink">
          {t("contents")}
        </h2>
        <ol className="mt-3 gap-x-8 text-sm sm:columns-2">
          {doc.sections.map((s, i) => (
            <li key={s.id} className="mb-2 flex break-inside-avoid gap-2">
              <span className="w-5 shrink-0 text-right text-muted tabular-nums">{i + 1}.</span>
              <a href={`#${s.id}`} className="text-primary-strong hover:underline">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {doc.sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="scroll-mt-24">
            <h2 id={`${s.id}-heading`} className="text-xl font-bold text-ink">
              <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className="mt-3 space-y-3 leading-relaxed text-ink">
              {s.blocks.map((b, j) =>
                typeof b === "string" ? (
                  <p key={j}>
                    <RichText text={b} />
                  </p>
                ) : (
                  <ul key={j} className="list-disc space-y-2 pl-6 marker:text-muted">
                    {b.list.map((item, k) => (
                      <li key={k}>
                        <RichText text={item} />
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <nav aria-labelledby="related" className="mt-14 border-t border-line pt-6">
        <h2 id="related" className="text-sm font-bold text-ink">
          {t("related")}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {others.map((s) => (
            <li key={s}>
              <Link href={`/legal/${s}`} className="text-primary-strong hover:underline">
                {legalDoc(s, locale).title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
