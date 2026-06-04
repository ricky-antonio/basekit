import type { SubscriptionStatus } from "@/lib/types"

// Subscription status as a labelled chip. Color is never the only signal — every status
// carries its text label too (code.md: no color-only state).
const STATUS_STYLES: Record<SubscriptionStatus, React.CSSProperties> = {
  active: { background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-border)" },
  trialing: { background: "var(--info-bg)", color: "var(--info-text)", border: "1px solid var(--info-border)" },
  past_due: { background: "var(--warning-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-border)" },
  canceled: { background: "var(--bg-surface-hover)", color: "var(--text-secondary)", border: "1px solid transparent" },
  incomplete: { background: "var(--warning-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-border)" },
  unpaid: { background: "var(--danger-bg)", color: "var(--danger-text)", border: "1px solid var(--danger-border)" },
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  unpaid: "Unpaid",
}

export default function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span
      data-status={status}
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ ...STATUS_STYLES[status], borderRadius: "var(--radius-sm)" }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
