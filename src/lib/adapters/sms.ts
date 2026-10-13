import "server-only";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * SMS via Infobip — paid per message, so OFF unless SMS_ENABLED=true.
 * Quiet hours (22:00–08:00 in the recipient's time zone) are enforced by the
 * notification service, not here.
 */
export interface SmsProvider {
  readonly name: string;
  readonly enabled: boolean;
  send(toE164: string, text: string): Promise<void>;
}

class InfobipProvider implements SmsProvider {
  readonly name = "infobip";
  readonly enabled = true;
  constructor(private baseUrl: string, private apiKey: string, private sender: string) {}
  async send(toE164: string, text: string) {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/sms/2/text/advanced`, {
      method: "POST",
      headers: { Authorization: `App ${this.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ messages: [{ from: this.sender, destinations: [{ to: toE164.replace(/^\+/, "") }], text }] }),
    });
    if (!res.ok) throw new Error(`Infobip ${res.status}`);
  }
}

class DisabledSms implements SmsProvider {
  readonly name = "disabled";
  readonly enabled = false;
  async send(toE164: string) {
    logger.debug("sms.disabled", { to: toE164.slice(0, 5) + "…" });
  }
}

let provider: SmsProvider | undefined;

export function sms(): SmsProvider {
  if (!provider) {
    const e = env();
    provider =
      e.SMS_ENABLED === "true" && e.INFOBIP_BASE_URL && e.INFOBIP_API_KEY && e.INFOBIP_SENDER
        ? new InfobipProvider(e.INFOBIP_BASE_URL, e.INFOBIP_API_KEY, e.INFOBIP_SENDER)
        : new DisabledSms();
  }
  return provider;
}

/** True if `now` falls in 22:00–08:00 local time for the given IANA zone. */
export function isQuietHours(timeZone: string, now = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now),
  );
  return hour >= 22 || hour < 8;
}
