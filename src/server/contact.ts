import "server-only";

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * The address shown on the contact page: CONTACT_EMAIL, else the sender address in EMAIL_FROM
 * when one has been set (a domain verified with Resend) and isn't a no-reply address. Null
 * until either is set, so the page never shows an address nobody reads. Pages are prerendered,
 * so a change needs a redeploy.
 */
export function contactEmail(): string | null {
  const explicit = process.env.CONTACT_EMAIL?.trim();
  if (explicit && EMAIL.test(explicit)) return explicit;
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) return null;
  const address = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
  if (!EMAIL.test(address) || /^no-?reply@/i.test(address)) return null;
  return address;
}
