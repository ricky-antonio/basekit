import { Button } from "@/components/ui/button"
import Link from "next/link"

interface EmptyStateProps {
  icon?: React.ReactNode
  headline: string
  body?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export default function EmptyState({
  icon,
  headline,
  body,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl"
      style={{ border: "1px dashed var(--border-default)" }}
    >
      {icon && (
        <div className="mb-4" style={{ color: "var(--text-muted)" }}>
          {icon}
        </div>
      )}
      <h3
        className="text-base font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {headline}
      </h3>
      {body && (
        <p className="text-sm mb-6 max-w-sm" style={{ color: "var(--text-secondary)" }}>
          {body}
        </p>
      )}
      {actionLabel && (
        <div className="mt-2">
          {actionHref ? (
            <Button asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      )}
    </div>
  )
}
