import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { WIZARD_STEPS, type WizardStep } from "@/lib/listing-config";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/form";

type Props = {
  businessId: string;
  businessName: string;
  current: WizardStep;
  done: WizardStep[];
  score: number;
  children: React.ReactNode;
};

/** Two-column wizard frame: step list + progress on the left, the current step on the right. */
export async function WizardShell({ businessId, businessName, current, done, score, children }: Props) {
  const t = await getTranslations("wizard");
  const index = WIZARD_STEPS.indexOf(current);
  const doneSet = new Set(done);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[17rem_1fr] lg:py-12">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="truncate font-heading text-lg font-bold text-ink">{businessName}</p>
        <div className="mt-3">
          <ProgressBar value={score} label={t("progress", { score })} />
          <p className="mt-1.5 text-sm text-muted">{t("progress", { score })}</p>
        </div>
        <p className="mt-4 text-sm font-semibold text-ink lg:hidden">
          {t("stepOf", { current: index + 1, total: WIZARD_STEPS.length })}
        </p>
        <nav aria-label={t("progress", { score })} className="mt-4 hidden lg:block">
          <ol className="space-y-1">
            {WIZARD_STEPS.map((step, i) => {
              const isCurrent = step === current;
              const isDone = doneSet.has(step);
              return (
                <li key={step}>
                  <Link
                    href={`/business/${businessId}/setup/${step}`}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm",
                      isCurrent ? "bg-primary-soft font-semibold text-primary-deeper" : "text-ink hover:bg-section",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                        isDone
                          ? "border-primary-strong bg-primary-strong text-white"
                          : isCurrent
                            ? "border-primary-strong text-primary-deeper"
                            : "border-line text-muted",
                      )}
                      aria-hidden
                    >
                      {isDone ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    {t(`steps.${step}`)}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      </aside>
      <section aria-labelledby="step-title" className="min-w-0">
        {children}
      </section>
    </div>
  );
}

/** Title + intro at the top of each step. */
export function StepHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="mb-8">
      <h1 id="step-title" className="text-2xl font-bold text-ink sm:text-3xl">
        {title}
      </h1>
      {intro ? <p className="mt-2 max-w-2xl text-muted">{intro}</p> : null}
    </header>
  );
}
