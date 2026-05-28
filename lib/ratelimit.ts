import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
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
} as const

export async function checkRateLimit(
  limiter: keyof typeof limiters,
  identifier: string,
): Promise<{ success: true } | { success: false; error: ApiError }> {
  const { success, reset } = await limiters[limiter].limit(identifier)
  if (success) return { success: true }
  return {
    success: false,
    error: {
      error: `Too many requests. Try again at ${new Date(reset).toLocaleTimeString()}.`,
      code: "RATE_LIMITED",
    },
  }
}
