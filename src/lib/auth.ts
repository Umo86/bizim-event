import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization } from "better-auth/plugins";
import { getDb } from "@/db";
import {
  account,
  invitation,
  member,
  organization as organizationTable,
  session,
  user,
  verification,
} from "@/db/schema";
import { sendActionEmail } from "@/emails/send";
import { env } from "@/lib/env";

/**
 * Better Auth — runs inside the Next.js app, tables in Neon.
 * Created lazily so `next build` never needs a database connection.
 */
function createAuth() {
  const e = env();
  const google =
    e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: "Bizim Event",
    baseURL: e.BETTER_AUTH_URL ?? e.NEXT_PUBLIC_APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.NEXT_PUBLIC_APP_URL],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification, organization: organizationTable, member, invitation },
    }),
    advanced: {
      database: { generateId: "uuid" },
      cookiePrefix: "be",
      useSecureCookies: e.NODE_ENV === "production",
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      additionalFields: {
        // `input: false` — a user can never set their own role at sign-up.
        role: { type: "string", required: false, defaultValue: "customer", input: false },
        phone: { type: "string", required: false },
        preferredLocale: { type: "string", required: false, defaultValue: "tr" },
        countryIso2: { type: "string", required: false },
        marketingOptInEmail: { type: "boolean", required: false, defaultValue: false },
        marketingOptInSms: { type: "boolean", required: false, defaultValue: false },
      },
      deleteUser: { enabled: true },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user: u, url }) => {
        await sendActionEmail("reset", u.email, url, (u as { preferredLocale?: string }).preferredLocale);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Logging in before verifying sends a fresh link (the sign-in form says so), so a lost
      // or expired first email doesn't strand the account.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user: u, url }) => {
        await sendActionEmail("verify", u.email, url, (u as { preferredLocale?: string }).preferredLocale);
      },
    },
    socialProviders: google,
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      customRules: {
        // Every page load asks "who's logged in?" for the header; it's answered from the
        // signed cookie cache, so limiting it only makes busy shared IPs look logged out.
        "/get-session": false,
      },
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        sendMagicLink: async ({ email, url }) => {
          await sendActionEmail("magic", email, url, null);
        },
      }),
      organization({
        // Business teams: the owner creates the organization; managers are invited as members.
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
      }),
      nextCookies(), // must stay last
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __bizimAuth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.__bizimAuth) globalForAuth.__bizimAuth = createAuth();
  return globalForAuth.__bizimAuth;
}

export type AppSession = Auth["$Infer"]["Session"];
