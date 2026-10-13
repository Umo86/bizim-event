import "server-only";
import { env } from "@/lib/env";

/**
 * "Translate with AI" for the listing editor: drafts the missing language for
 * the owner to review — never publishes automatically. Stub until a provider
 * key is configured (wired up in Phase 2).
 */
export interface TranslateProvider {
  readonly name: string;
  readonly enabled: boolean;
  translate(text: string, from: "tr" | "en", to: "tr" | "en"): Promise<string | null>;
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
    // Provider implementations are added in Phase 2; the flag keeps the UI honest.
    void env().TRANSLATE_PROVIDER;
    provider = new StubTranslate();
  }
  return provider;
}
