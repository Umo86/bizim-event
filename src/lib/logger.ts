/**
 * Structured JSON logger (one line per event — readable in Vercel logs).
 * `captureException` is the single hook to wire Sentry into later.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function write(level: Level, event: string, fields?: Fields) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: Fields) => {
    if (process.env.NODE_ENV !== "production") write("debug", event, fields);
  },
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};

export function captureException(error: unknown, context?: Fields) {
  const err = error instanceof Error ? error : new Error(String(error));
  write("error", "exception", { message: err.message, stack: err.stack, ...context });
  // Sentry-ready: if (process.env.SENTRY_DSN) Sentry.captureException(err, { extra: context });
}
