import "server-only";
import { cached } from "./redis";

/**
 * Exchange rates from Frankfurter (free ECB reference rates), cached daily.
 * Used only for "≈ £X" hints and GBP normalisation — prices are always shown
 * in the listing's own currency.
 */
export type Rates = { base: string; date: string; rates: Record<string, number> };

const FRANKFURTER = "https://api.frankfurter.dev/v1/latest";

export async function getRates(base = "GBP"): Promise<Rates> {
  return cached(`fx:${base}:${new Date().toISOString().slice(0, 10)}`, 60 * 60 * 26, async () => {
    const res = await fetch(`${FRANKFURTER}?base=${encodeURIComponent(base)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
    const json = (await res.json()) as Rates;
    return { ...json, rates: { ...json.rates, [base]: 1 } };
  });
}

/** Convert using rates quoted against `rates.base`. Returns null when a currency is unknown. */
export function convert(amount: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return amount;
  const fromRate = from === rates.base ? 1 : rates.rates[from];
  const toRate = to === rates.base ? 1 : rates.rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}
