import { humanizeAction } from "@/lib/admin-format"
import type { AdminActivityRow } from "@/lib/admin-activity"

interface RecentActivityProps {
  activities: AdminActivityRow[]
  title?: string
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// Best-effort one-line context from the row's metadata. Activities span domains, so
// only a few well-known keys are surfaced; everything else falls back to the target.
function detailOf(row: AdminActivityRow): string | null {
  const meta = row.metadata
  const from = typeof meta["from"] === "string" ? meta["from"] : null
  const to = typeof meta["to"] === "string" ? meta["to"] : null
  if (from && to) {
    const reason = typeof meta["reason"] === "string" ? ` · ${meta["reason"]}` : ""
    return `${from} → ${to}${reason}`
  }
  if (typeof meta["email"] === "string") return meta["email"]
  if (typeof meta["name"] === "string") return meta["name"]
  if (row.targetType) return row.targetType
  return null
}

export default function RecentActivity({ activities, title = "Recent activity" }: RecentActivityProps) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
    >
      <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>

      {activities.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          No activity yet.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="activity-list">
          {activities.map((row) => {
            const detail = detailOf(row)
            return (
              <li key={row.id} className="flex items-start justify-between gap-3" data-testid="activity-row">
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {humanizeAction(row.action)}
                    {row.impersonatorId && (
                      <span
                        className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ color: "var(--danger-text)" }}
                      >
                        Impersonated
                      </span>
                    )}
                  </p>
                  {detail && (
                    <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                      {detail}
                    </p>
                  )}
                </div>
                <time
                  className="shrink-0 text-xs"
                  style={{ color: "var(--text-muted)" }}
                  dateTime={row.createdAt}
                >
                  {formatWhen(row.createdAt)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
