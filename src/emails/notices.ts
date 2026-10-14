import "server-only";
import { render } from "@react-email/components";
import { getFormatter, getTranslations } from "next-intl/server";
import { sendEmail } from "@/lib/adapters/email";
import { env } from "@/lib/env";
import { captureException } from "@/lib/logger";
import { formatPlanAmount, PLANS, type PlanKey } from "@/lib/plans";
import { isLocale, type AppLocale } from "@/i18n/routing";
import { NoticeEmail } from "./notice-email";

export type NoticeKind =
  | "businessSubmitted"
  | "listingSubmitted"
  | "businessApproved"
  | "businessChangesRequested"
  | "businessRejected"
  | "listingApproved"
  | "listingChangesRequested"
  | "listingRejected"
  // Billing
  | "trialEnding"
  | "trialEnded"
  | "planScheduled"
  | "subscriptionStarted"
  | "paymentFailed"
  | "paymentRecovered"
  | "cancelScheduled"
  | "subscriptionEnded"
  | "graceEnded";

type Params = {
  business?: string;
  listing?: string;
  note?: string | null;
  /** The date the message is about: trial end, renewal, grace deadline… */
  date?: Date | string | null;
  /** Days left, for trial reminders. */
  days?: number;
  plan?: PlanKey | null;
  /** Path after /<locale>, e.g. "/business/<id>" */
  path: string;
};

/**
 * Sends a transactional notice in the recipient's language. Never throws —
 * an email outage must not undo an approval or a submission.
 */
export async function sendNotice(kind: NoticeKind, to: string, locale: string | null | undefined, params: Params) {
  try {
    const loc: AppLocale = isLocale(locale) ? locale : "tr";
    const t = await getTranslations({ locale: loc, namespace: `email.notices.${kind}` });
    const tc = await getTranslations({ locale: loc, namespace: "email" });
    const format = await getFormatter({ locale: loc });
    const values = {
      business: params.business ?? "",
      listing: params.listing ?? "",
      date: params.date
        ? format.dateTime(new Date(params.date), { day: "numeric", month: "long", year: "numeric" })
        : "",
      days: params.days ?? 0,
      plan: params.plan ? (loc === "tr" ? PLANS[params.plan].nameTr : PLANS[params.plan].nameEn) : "",
      amount: params.plan ? formatPlanAmount(params.plan, loc) : "",
      monthly: formatPlanAmount("monthly", loc),
      yearly: formatPlanAmount("yearly", loc),
    };
    const base = (env().NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const props = {
      locale: loc,
      heading: t("heading", values),
      paragraphs: [t("body", values)],
      quote: params.note ?? null,
      buttonLabel: t("button"),
      url: `${base}/${loc}${params.path}`,
      footer: tc("noticeFooter"),
    };
    const element = NoticeEmail(props);
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
    await sendEmail({ to, subject: t("subject", values), html, text, tags: [{ name: "kind", value: kind }] });
  } catch (err) {
    captureException(err, { where: "sendNotice", kind });
  }
}
