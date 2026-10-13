import "server-only";
import { render } from "@react-email/components";
import { getTranslations } from "next-intl/server";
import { sendEmail } from "@/lib/adapters/email";
import { isLocale, type AppLocale } from "@/i18n/routing";
import { ActionEmail } from "./action-email";

type ActionKind = "verify" | "magic" | "reset";

/** Renders and sends a TR/EN action email in the recipient's preferred locale. */
export async function sendActionEmail(kind: ActionKind, to: string, url: string, locale: string | null | undefined) {
  const loc: AppLocale = isLocale(locale) ? locale : "tr";
  const t = await getTranslations({ locale: loc, namespace: "email" });
  const props = {
    locale: loc,
    heading: t(`${kind}Subject`),
    body: t(`${kind}Body`),
    buttonLabel: t(`${kind}Button`),
    url,
    footnote: t("ignore"),
  };
  const element = ActionEmail(props);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  await sendEmail({ to, subject: props.heading, html, text, tags: [{ name: "kind", value: kind }] });
}
