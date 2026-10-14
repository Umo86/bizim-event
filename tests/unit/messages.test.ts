import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

/**
 * Both languages must say the same things: the same keys, and in each message the same
 * placeholders ({date}) and rich-text tags (<link>…</link>), so no page shows a raw key or
 * drops a value in one language.
 */

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Argument names in an ICU message: {date}, {count, plural, …} — not the text inside branches. */
function placeholders(message: string): string[] {
  const names = new Set<string>();
  // Reads message text from i until an unmatched "}" (or the end); returns the index there.
  const text = (i: number): number => {
    while (i < message.length && message[i] !== "}") i = message[i] === "{" ? argument(i + 1) : i + 1;
    return i;
  };
  // Reads an argument after its "{"; returns the index after its closing "}".
  const argument = (i: number): number => {
    let j = i;
    while (j < message.length && !",}".includes(message[j])) j++;
    names.add(message.slice(i, j).trim());
    if (message[j] === "}") return j + 1;
    let k = j + 1;
    while (k < message.length && !",}".includes(message[k])) k++;
    const type = message.slice(j + 1, k).trim();
    if (!["plural", "select", "selectordinal"].includes(type)) {
      while (k < message.length && message[k] !== "}") k++;
      return k + 1;
    }
    // Branches: key {message} key {message} … }
    while (k < message.length && message[k] !== "}") {
      if (message[k] === "{") k = text(k + 1) + 1;
      else k++;
    }
    return k + 1;
  };
  text(0);
  return [...names].sort();
}
const tags = (s: string) => [...new Set([...s.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();

const EN = flatten(en as Tree);
const TR = flatten(tr as Tree);

describe("messages", () => {
  it("(the checks read ICU arguments and tags correctly)", () => {
    expect(placeholders("{a} at {n, plural, one {# {b}} other {Venues}} on {d, date, long}")).toEqual([
      "a",
      "b",
      "d",
      "n",
    ]);
    expect(tags("Read <terms>this</terms> and <privacy>that</privacy>")).toEqual(["privacy", "terms"]);
  });

  it("have the same keys in Turkish and English", () => {
    expect([...TR.keys()].filter((k) => !EN.has(k))).toEqual([]);
    expect([...EN.keys()].filter((k) => !TR.has(k))).toEqual([]);
  });

  it("use the same placeholders and tags in both languages", () => {
    const mismatches: string[] = [];
    for (const [key, enText] of EN) {
      const trText = TR.get(key);
      if (trText === undefined) continue;
      if (placeholders(enText).join() !== placeholders(trText).join()) mismatches.push(`${key}: placeholders`);
      if (tags(enText).join() !== tags(trText).join()) mismatches.push(`${key}: tags`);
    }
    expect(mismatches).toEqual([]);
  });

  it("are never empty", () => {
    const empty = [...EN, ...TR].filter(([, text]) => !text.trim()).map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
