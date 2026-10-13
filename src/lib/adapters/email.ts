import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private client: Resend,
    private from: string,
  ) {}
  async send(m: EmailMessage) {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      replyTo: m.replyTo,
      tags: m.tags,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return { id: data?.id ?? null };
  }
}

/**
 * Where development keeps the emails it would have sent (one JSON object per line),
 * so verification and login links can be opened — by people and by the e2e tests.
 */
export const DEV_EMAIL_OUTBOX = ".dev-emails/outbox.jsonl";

/** Dev/CI fallback: logs the email instead of sending it, and outside production keeps a copy in the outbox. */
class ConsoleProvider implements EmailProvider {
  readonly name = "console";
  async send(m: EmailMessage) {
    logger.info("email.console", { to: m.to, subject: m.subject, preview: (m.text ?? m.html).slice(0, 400) });
    if (process.env.NODE_ENV !== "production") await saveToOutbox(m);
    return { id: null };
  }
}

async function saveToOutbox(m: EmailMessage) {
  const { appendFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  // turbopackIgnore: a dev-only file must not make the build trace the whole project.
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), DEV_EMAIL_OUTBOX);
  const entry = {
    at: new Date().toISOString(),
    to: Array.isArray(m.to) ? m.to : [m.to],
    subject: m.subject,
    kind: m.tags?.find((t) => t.name === "kind")?.value ?? null,
    text: m.text ?? null,
  };
  try {
    await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
    await appendFile(/*turbopackIgnore: true*/ file, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    logger.warn("email.outbox_failed", { message: error instanceof Error ? error.message : String(error) });
  }
}

let provider: EmailProvider | undefined;

export function emailProvider(): EmailProvider {
  if (!provider) {
    const e = env();
    provider = e.RESEND_API_KEY
      ? new ResendProvider(new Resend(e.RESEND_API_KEY), e.EMAIL_FROM)
      : new ConsoleProvider();
  }
  return provider;
}

export function sendEmail(message: EmailMessage) {
  return emailProvider().send(message);
}
