import { createClient } from "@/lib/supabase/server"
import type { ApiResult } from "@/lib/types"
import type { Database } from "@/lib/database.types"

export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"]

export async function getSubscription(workspaceId: string): Promise<ApiResult<Subscription>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, workspace_id, plan_name, status, cancel_at_period_end, current_period_start, current_period_end, trial_end, stripe_customer_id, stripe_subscription_id, stripe_price_id, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: { error: "Subscription not found.", code: "NOT_FOUND" },
    }
  }

  return { ok: true, data }
}
