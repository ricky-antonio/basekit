interface UsageBarProps {
  label: string
  used: number
  maxCount: number | null
}

type FillState = "unlimited" | "full" | "warning" | "normal"

function getFillState(used: number, maxCount: number | null): FillState {
  if (maxCount === null) return "unlimited"
  if (used >= maxCount) return "full"
  if (maxCount > 0 && used / maxCount >= 0.8) return "warning"
  return "normal"
}

const FILL_COLORS: Record<FillState, string> = {
  unlimited: "var(--brand-primary)",
  normal: "var(--brand-primary)",
  warning: "var(--warning-solid)",
  full: "var(--danger-solid)",
}

export default function UsageBar({ label, used, maxCount }: UsageBarProps) {
  const state = getFillState(used, maxCount)
  const pct = maxCount === null ? 0 : maxCount > 0 ? Math.min(100, Math.round((used / maxCount) * 100)) : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
        </span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {maxCount === null ? "Unlimited" : `${used} / ${maxCount}`}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--bg-surface-hover)" }}
      >
        <div
          role="progressbar"
          aria-label={`${label} usage`}
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={maxCount ?? 0}
          data-state={state}
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: FILL_COLORS[state],
          }}
        />
      </div>
    </div>
  )
}
