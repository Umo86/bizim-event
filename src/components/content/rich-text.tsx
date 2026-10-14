import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

export const textLinkClass =
  "font-semibold text-primary-strong underline decoration-1 underline-offset-2 hover:decoration-2";

/** Plain text with [label](/path) links, as written in src/content; paths are locale-aware. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Link key={m.index} href={m[2]} className={textLinkClass}>
        {m[1]}
      </Link>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
