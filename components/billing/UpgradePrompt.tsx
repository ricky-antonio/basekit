import Link from "next/link"
import { Button } from "@/components/ui/button"
import { IconArrowUpRight, IconSparkles } from "@tabler/icons-react"
import type { ApiError } from "@/lib/types"

interface UpgradePromptProps {
  error: ApiError | null | undefined
  currentPlan?: string
}

// Renders only when an action failed with LIMIT_EXCEEDED. Anything else (no error,
// a different code) renders nothing, so callers can pass their action result
// straight through without branching.
export default function UpgradePrompt({ error, currentPlan }: UpgradePromptProps) {
  if (!error || error.code !== "LIMIT_EXCEEDED") return null

  const upgradeUrl = error.upgradeUrl ?? "/settings/billing"

  return (
    <div
      role="alert"
      className="rounded-xl p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: "var(--brand-bg-soft)",
        border: "1px solid var(--brand-border-soft)",
      }}
    >
      <div className="flex items-start gap-3">
        <IconSparkles
          size={20}
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          style={{ color: "var(--brand-primary)" }}
        />
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            You&rsquo;ve reached your plan limit
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {error.error}
            {currentPlan ? ` You’re currently on the ${currentPlan} plan.` : ""}
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0">
        <Link href={upgradeUrl} className="flex items-center gap-1.5">
          Upgrade plan
          <IconArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </Button>
    </div>
  )
}
