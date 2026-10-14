import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Notice } from "@/components/ui/form";
import { formatPlanAmount, PLANS, type PlanKey } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { BillingState } from "@/server/rules";

type Locale = "tr" | "en";
type Tone = "info" | "success" | "warning" | "danger";

async function helpers(locale: Locale, timeZone: string | null) {
  const t = await getTranslations({ locale, namespace: "billing" });
  const format = await getFormatter({ locale });
  const date = (d: Date | null | undefined) =>
    d
      ? format.dateTime(d, { day: "numeric", month: "long", year: "numeric", timeZone: timeZone ?? "Europe/London" })
      : "";
  const plan = (p: PlanKey | null) => (p ? (locale === "tr" ? PLANS[p].nameTr : PLANS[p].nameEn) : "");
  return { t, date, plan };
}

/** Title, explanation and tone for each billing state, on the owner's billing page. */
export async function billingCopy(state: BillingState, locale: Locale, timeZone: string | null) {
  const { t, date, plan } = await helpers(locale, timeZone);
  const copy: Record<BillingState["kind"], () => { tone: Tone; title: string; body: string }> = {
    trial: () => {
      const s = state as Extract<BillingState, { kind: "trial" }>;
      return {
        tone: s.endingSoon ? "warning" : "info",
        title: s.endingSoon ? t("trialEndingTitle") : t("trialTitle"),
        body: t("trialBody", { days: s.daysLeft, date: date(s.endsAt) }),
      };
    },
    scheduled: () => {
      const s = state as Extract<BillingState, { kind: "scheduled" }>;
      return {
        tone: "success",
        title: t("scheduledTitle", { plan: plan(s.plan), date: date(s.startsAt) }),
        body: t("scheduledBody", { plan: plan(s.plan), amount: s.plan ? formatPlanAmount(s.plan, locale) : "" }),
      };
    },
    active: () => {
      const s = state as Extract<BillingState, { kind: "active" }>;
      return {
        tone: "success",
        title: t("activeTitle", { plan: plan(s.plan) }),
        body: s.plan
          ? t("activeBody", {
              interval: PLANS[s.plan].interval,
              amount: formatPlanAmount(s.plan, locale),
              date: date(s.renewsAt),
            })
          : "",
      };
    },
    ending: () => {
      const s = state as Extract<BillingState, { kind: "ending" }>;
      return { tone: "info", title: t("endingTitle", { date: date(s.endsAt) }), body: t("endingBody") };
    },
    past_due: () => {
      const s = state as Extract<BillingState, { kind: "past_due" }>;
      return { tone: "danger", title: t("pastDueTitle"), body: t("pastDueBody", { date: date(s.graceUntil) }) };
    },
    canceled: () => {
      const s = state as Extract<BillingState, { kind: "canceled" }>;
      return { tone: "warning", title: t("canceledTitle"), body: t("canceledBody", { date: date(s.liveUntil) }) };
    },
    expired: () => {
      const s = state as Extract<BillingState, { kind: "expired" }>;
      const body =
        s.reason === "trial_ended"
          ? t("expiredTrial")
          : s.reason === "payment_failed"
            ? t("expiredPayment")
            : t("expiredCanceled");
      return { tone: "danger", title: t("expiredTitle"), body };
    },
    comped: () => ({ tone: "success", title: t("compedTitle"), body: t("compedBody") }),
  };
  return copy[state.kind]();
}

const accents: Record<Tone, string> = {
  info: "border-l-primary-strong",
  success: "border-l-success",
  warning: "border-l-amber-500",
  danger: "border-l-danger",
};

/** The big status panel at the top of the billing page. */
export async function BillingStatusPanel({
  state,
  locale,
  timeZone,
}: {
  state: BillingState;
  locale: Locale;
  timeZone: string | null;
}) {
  const { tone, title, body } = await billingCopy(state, locale, timeZone);
  return (
    <div
      role="status"
      className={cn("rounded-2xl border border-l-4 border-line bg-white p-6 shadow-card", accents[tone])}
    >
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {body ? <p className="mt-2 max-w-prose text-ink">{body}</p> : null}
    </div>
  );
}

/**
 * One line on the business overview: how billing stands and a link to act on it. Owners
 * only — managers see the plain approval banner.
 */
export async function BillingBanner({
  state,
  businessId,
  locale,
  timeZone,
  approvedLabel,
}: {
  state: BillingState;
  businessId: string;
  locale: Locale;
  timeZone: string | null;
  approvedLabel: string;
}) {
  const { t, date } = await helpers(locale, timeZone);
  const to = `/business/${businessId}/billing`;
  const banner: { tone: Tone; text: string; link: string } = (() => {
    switch (state.kind) {
      case "trial":
        return state.endingSoon
          ? { tone: "warning", text: t("bannerTrialEnding", { date: date(state.endsAt) }), link: t("choosePlan") }
          : {
              tone: "success",
              text: t("bannerTrial", { days: state.daysLeft, date: date(state.endsAt) }),
              link: t("choosePlan"),
            };
      case "expired":
        return { tone: "danger", text: t("bannerExpired"), link: t("choosePlan") };
      case "past_due":
        return { tone: "danger", text: t("bannerPastDue", { date: date(state.graceUntil) }), link: t("openBilling") };
      case "ending":
        return { tone: "info", text: t("bannerEnding", { date: date(state.endsAt) }), link: t("openBilling") };
      case "canceled":
        return { tone: "warning", text: t("bannerCanceled", { date: date(state.liveUntil) }), link: t("choosePlan") };
      default:
        return { tone: "success", text: approvedLabel, link: t("openBilling") };
    }
  })();
  return (
    <Notice tone={banner.tone}>
      <span className="mr-2">{banner.text}</span>
      <Link href={to} className="font-semibold underline underline-offset-2 hover:no-underline">
        {banner.link}
      </Link>
    </Notice>
  );
}
