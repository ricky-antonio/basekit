import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import PlanBadge from "@/components/billing/PlanBadge"
import StatusBadge from "@/components/admin/StatusBadge"
import type { AdminUserDetail } from "@/lib/admin"

interface UserDetailHeaderProps {
  detail: AdminUserDetail
  onOverride: () => void
  onImpersonate: () => void
  impersonating: boolean
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()
}

export default function UserDetailHeader({
  detail,
  onOverride,
  onImpersonate,
  impersonating,
}: UserDetailHeaderProps) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl p-6 sm:flex-row sm:items-center sm:justify-between"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <Avatar className="h-12 w-12 shrink-0">
          {detail.avatarUrl && <AvatarImage src={detail.avatarUrl} alt={detail.displayName} />}
          <AvatarFallback
            className="text-sm font-semibold"
            style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}
          >
            {initialsOf(detail.displayName) || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {detail.displayName}
            </h1>
            {detail.role === "admin" && (
              <span
                className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ background: "var(--info-bg)", color: "var(--info-text)", border: "1px solid var(--info-border)", borderRadius: "var(--radius-sm)" }}
              >
                Admin
              </span>
            )}
          </div>
          {detail.email && (
            <p className="truncate text-sm" style={{ color: "var(--text-secondary)" }}>
              {detail.email}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {detail.subscription ? (
              <>
                <PlanBadge plan={detail.subscription.planName} />
                <StatusBadge status={detail.subscription.status} />
              </>
            ) : (
              <PlanBadge plan="free" />
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onOverride}>
          Override plan
        </Button>
        <Button
          className="min-h-11 w-full sm:w-auto"
          style={{ background: "var(--danger-solid)", color: "#FFFFFF" }}
          onClick={onImpersonate}
          disabled={impersonating}
        >
          {impersonating ? "Impersonating…" : "Impersonate"}
        </Button>
      </div>
    </div>
  )
}
