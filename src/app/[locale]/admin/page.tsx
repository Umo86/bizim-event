import { redirect } from "@/i18n/navigation";
import { asLocale } from "@/server/page-helpers";

export default async function AdminHome(props: PageProps<"/[locale]/admin">) {
  const { locale } = await props.params;
  redirect({ href: "/admin/approvals", locale: asLocale(locale) });
}
