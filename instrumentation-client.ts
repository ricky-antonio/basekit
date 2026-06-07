// Client-side Sentry. Scope (per CLAUDE.md): error tracking only — no Session Replay
// and no browser performance tracing, both of which the wizard enables by default and
// which dominate the client bundle. Server-side webhook/API errors are the priority.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://09957084f38a8ab45405bf2ffa1caddc@o4508965978177536.ingest.us.sentry.io/4511465446375424",

  // Error capture only — no perf tracing on the client.
  tracesSampleRate: 0,

  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
