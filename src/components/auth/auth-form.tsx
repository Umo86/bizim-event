"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter as useRawRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});
type Values = z.infer<typeof schema>;

export function AuthForm({ mode, googleEnabled }: { mode: Mode; googleEnabled: boolean }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRawRouter();
  const search = useSearchParams();
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const { register, handleSubmit, getValues, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  // Only same-site, locale-prefixed paths are accepted as a return address.
  const nextParam = search.get("next");
  const callbackURL =
    nextParam && /^\/(tr|en)(\/|$)/.test(nextParam) && !nextParam.startsWith("//") ? nextParam : `/${locale}/account`;
  const otherModeHref = `${mode === "sign-in" ? "/sign-up" : "/sign-in"}${nextParam ? `?next=${encodeURIComponent(callbackURL)}` : ""}`;

  const onSubmit = async (v: Values) => {
    setNotice(null);
    if (mode === "sign-up") {
      const { error } = await signUp.email({
        name: v.name || v.email.split("@")[0],
        email: v.email,
        password: v.password,
        callbackURL,
        preferredLocale: locale,
      } as Parameters<typeof signUp.email>[0]);
      if (error) {
        // Better Auth's own messages are English-only, so they aren't shown.
        return setNotice({ kind: "error", text: error.status === 429 ? t("tooManyAttempts") : t("genericError") });
      }
      return setNotice({ kind: "ok", text: t("verifyEmailSent") });
    }
    const { error } = await signIn.email({ email: v.email, password: v.password, callbackURL });
    if (error) {
      const text =
        error.status === 403
          ? t("emailNotVerified")
          : error.status === 401
            ? t("invalidCredentials")
            : error.status === 429
              ? t("tooManyAttempts")
              : t("genericError");
      return setNotice({ kind: "error", text });
    }
    router.push(callbackURL);
    router.refresh();
  };

  const sendMagicLink = async () => {
    const email = getValues("email");
    if (!z.string().email().safeParse(email).success) return setNotice({ kind: "error", text: t("email") });
    const { error } = await signIn.magicLink({ email, callbackURL });
    setNotice(error ? { kind: "error", text: t("genericError") } : { kind: "ok", text: t("magicLinkSent") });
  };

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <Button
            variant="outline"
            className="w-full"
            type="button"
            onClick={() => signIn.social({ provider: "google", callbackURL })}
          >
            {t("google")}
          </Button>
          <div className="flex items-center gap-3 text-xs uppercase text-muted">
            <span className="h-px flex-1 bg-line" />
            {tc("or")}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {mode === "sign-up" && (
          <div>
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" autoComplete="name" {...register("name")} />
          </div>
        )}
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!formState.errors.email}
            {...register("email")}
          />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            aria-describedby="password-hint"
            aria-invalid={!!formState.errors.password}
            {...register("password")}
          />
          <p id="password-hint" className="mt-1 text-xs text-muted">
            {t("passwordHint")}
          </p>
        </div>

        {notice && (
          <p
            role="status"
            className={
              notice.kind === "ok"
                ? "rounded-lg bg-primary-soft p-3 text-sm text-ink"
                : "rounded-lg bg-red-50 p-3 text-sm text-danger"
            }
          >
            {notice.text}
          </p>
        )}

        <Button type="submit" variant="cta" className="w-full" disabled={formState.isSubmitting}>
          {mode === "sign-up" ? t("signUpButton") : t("signInButton")}
        </Button>
      </form>

      {mode === "sign-in" && (
        <Button type="button" variant="outline" className="w-full" onClick={sendMagicLink}>
          {t("magicLinkButton")}
        </Button>
      )}

      <p className="text-center text-sm text-muted">
        {mode === "sign-in" ? t("noAccount") : t("haveAccount")}{" "}
        <Link href={otherModeHref} className="font-semibold text-primary-strong hover:underline">
          {mode === "sign-in" ? t("signUpButton") : t("signInButton")}
        </Link>
      </p>
    </div>
  );
}
