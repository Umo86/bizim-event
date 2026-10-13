import "server-only";
import Pusher from "pusher";
import { env } from "@/lib/env";

/**
 * Realtime chat delivery. Messages are stored in Postgres; this adapter only
 * pushes "new message" events. Swap Pusher for Ably by adding a provider here.
 * When unconfigured, the client falls back to 15-second polling while the chat
 * tab is visible (see src/lib/realtime-client.ts).
 */
export interface RealtimeProvider {
  readonly name: string;
  readonly enabled: boolean;
  trigger(channel: string, event: string, data: unknown): Promise<void>;
  /** Returns the auth payload for a private channel, or null if refused. */
  authorizeChannel(socketId: string, channel: string): { auth: string } | null;
}

class PusherProvider implements RealtimeProvider {
  readonly name = "pusher";
  readonly enabled = true;
  constructor(private client: Pusher) {}
  async trigger(channel: string, event: string, data: unknown) {
    await this.client.trigger(channel, event, data);
  }
  authorizeChannel(socketId: string, channel: string) {
    return this.client.authorizeChannel(socketId, channel);
  }
}

class NoopRealtime implements RealtimeProvider {
  readonly name = "polling";
  readonly enabled = false;
  async trigger() {}
  authorizeChannel() {
    return null;
  }
}

let provider: RealtimeProvider | undefined;

export function realtime(): RealtimeProvider {
  if (!provider) {
    const e = env();
    provider =
      e.PUSHER_APP_ID && e.PUSHER_SECRET && e.NEXT_PUBLIC_PUSHER_KEY
        ? new PusherProvider(
            new Pusher({
              appId: e.PUSHER_APP_ID,
              key: e.NEXT_PUBLIC_PUSHER_KEY,
              secret: e.PUSHER_SECRET,
              cluster: e.NEXT_PUBLIC_PUSHER_CLUSTER,
              useTLS: true,
            }),
          )
        : new NoopRealtime();
  }
  return provider;
}

/** Channel naming — the auth endpoint checks the caller is a party to the enquiry. */
export const channels = {
  enquiry: (enquiryId: string) => `private-enquiry-${enquiryId}`,
  user: (userId: string) => `private-user-${userId}`,
};

export function parseEnquiryChannel(channel: string): string | null {
  const m = /^private-enquiry-([0-9a-f-]{36})$/.exec(channel);
  return m ? m[1] : null;
}
export function parseUserChannel(channel: string): string | null {
  const m = /^private-user-([0-9a-f-]{36})$/.exec(channel);
  return m ? m[1] : null;
}
