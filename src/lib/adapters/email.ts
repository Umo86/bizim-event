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
  constructor(private client: Resend, private from: string) {}
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

/** Dev/CI fallback: logs the email instead of sending it. */
class ConsoleProvider implements EmailProvider {
  readonly name = "console";
  async send(m: EmailMessage) {
    logger.info("email.console", { to: m.to, subject: m.subject, preview: (m.text ?? m.html).slice(0, 400) });
    return { id: null };
  }
}

let provider: EmailProvider | undefined;

export function emailProvider(): EmailProvider {
  if (!provider) {
    const e = env();
    provider = e.RESEND_API_KEY ? new ResendProvider(new Resend(e.RESEND_API_KEY), e.EMAIL_FROM) : new ConsoleProvider();
  }
  return provider;
}

export function sendEmail(message: EmailMessage) {
  return emailProvider().send(message);
}
