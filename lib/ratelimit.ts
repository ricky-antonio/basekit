import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import * as Sentry from "@sentry/nextjs"
import type { ApiError } from "@/lib/types"

const redis = Redis.fromEnv()

export const limiters = {
  login: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), prefix: "rl:login" }),
  signup: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), prefix: "rl:signup" }),
  passwordReset: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:pwreset" }),
  magicLink: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:magic" }),
  billingCheckout: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "rl:bill:co" }),
  billingPortal: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "rl:bill:po" }),
  billingCancel: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m"), prefix: "rl:bill:cn" }),
  teamInvite: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 h"), prefix: "rl:team:in" }),
  teamAccept: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "rl:team:ac" }),
  teamRemove: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "rl:team:rm" }),
  adminWrite: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "rl:adm:wr" }),
  webhookStripe: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "10 s"), prefix: "rl:wh:st" }),
  settingsWrite: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "rl:set:wr" }),
  passwordChange: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:set:pw" }),
  accountDelete: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "rl:set:del" }),
  avatarUpload: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "5 m"), prefix: "rl:set:av" }),
} as const

export async function checkRateLimit(
  limiter: keyof typeof limiters,
  identifier: string,
): Promise<{ success: true } | { success: false; error: ApiError }> {
  let result: { success: boolean; reset: number }
  try {
    result = await limiters[limiter].limit(identifier)
  } catch (error) {
    // Fail OPEN: if Redis is unreachable we allow the request rather than 500.
    // Blocking every request (incl. Stripe webhooks, which would then retry-storm)
    // on a rate-limiter outage is worse than briefly skipping the limit.
    console.error(`[ratelimit] ${limiter} check failed; failing open`, error)
    Sentry.captureException(error)
    return { success: true }
  }

  if (result.success) return { success: true }
  return {
    success: false,
    error: {
      error: `Too many requests. Try again at ${new Date(result.reset).toLocaleTimeString()}.`,
      code: "RATE_LIMITED",
    },
  }
}
