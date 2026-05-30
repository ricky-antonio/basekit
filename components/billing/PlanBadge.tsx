import { cn } from "@/lib/utils"
import type { PlanName } from "@/lib/types"

interface PlanBadgeProps {
  plan: PlanName
  className?: string
}

const BADGE_STYLES: Record<PlanName, { bg: string; text: string }> = {
  free: { bg: "var(--bg-surface-hover)", text: "var(--text-secondary)" },
  pro: { bg: "var(--brand-bg-soft)", text: "var(--brand-primary)" },
  enterprise: { bg: "var(--accent-indigo-soft)", text: "var(--accent-indigo)" },
}

const LABELS: Record<PlanName, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
}

export default function PlanBadge({ plan, className }: PlanBadgeProps) {
  const style = BADGE_STYLES[plan]
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}
      style={{ background: style.bg, color: style.text }}
    >
      {LABELS[plan]}
    </span>
  )
}
