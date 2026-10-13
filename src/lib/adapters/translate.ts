import "server-only";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * "Translate with AI" for the listing editor: drafts the missing language for
 * the owner to review — it never publishes anything by itself.
 *  - anthropic: Claude Messages API (TRANSLATE_PROVIDER=anthropic + ANTHROPIC_API_KEY)
 *  - stub: disabled; the button is hidden in the UI
 */
export interface TranslateProvider {
  readonly name: string;
  readonly enabled: boolean;
  translate(text: string, from: "tr" | "en", to: "tr" | "en"): Promise<string | null>;
}

const LANG = { tr: "Turkish", en: "English" } as const;

class AnthropicTranslate implements TranslateProvider {
  readonly name = "anthropic";
  readonly enabled = true;
  constructor(
    private apiKey: string,
    private model: string,
  ) {}
  async translate(text: string, from: "tr" | "en", to: "tr" | "en") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system:
          `You translate marketplace listing copy for an events marketplace from ${LANG[from]} to ${LANG[to]}. ` +
          "Keep the meaning, tone, names, numbers and line breaks. Keep Turkish cultural terms that have no English " +
          "equivalent (kına gecesi, davul-zurna, sünnet, mevlit, halay) and add a short gloss in brackets only the first time. " +
          "Reply with the translation only — no preamble, no quotes.",
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) {
      logger.warn("translate.anthropic_failed", { status: res.status });
      return null;
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const out = json.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();
    return out || null;
  }
}

class StubTranslate implements TranslateProvider {
  readonly name = "stub";
  readonly enabled = false;
  async translate() {
    return null;
  }
}

let provider: TranslateProvider | undefined;

export function translator(): TranslateProvider {
  if (!provider) {
    const e = env();
    provider =
      e.TRANSLATE_PROVIDER === "anthropic" && e.ANTHROPIC_API_KEY
        ? new AnthropicTranslate(e.ANTHROPIC_API_KEY, e.TRANSLATE_MODEL)
        : new StubTranslate();
  }
  return provider;
}

export function translationEnabled() {
  return translator().enabled;
}
