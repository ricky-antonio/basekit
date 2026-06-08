import { IconSparkles } from "@tabler/icons-react"
import { isDemoEmail } from "@/lib/demo"

// Persistent banner shown only while signed in as a demo account, so visitors always know
// the data is shared + ephemeral and that some destructive actions are intentionally off.
export default function DemoBanner({ email }: { email: string | null | undefined }) {
  if (!isDemoEmail(email)) return null
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium sm:text-sm"
      style={{
        background: "var(--brand-bg-soft)",
        color: "var(--brand-primary)",
        borderBottom: "1px solid var(--brand-border-soft)",
      }}
    >
      <IconSparkles size={14} aria-hidden="true" className="shrink-0" />
      <span>
        You&apos;re exploring the <strong>basekit demo</strong> — data resets nightly, and some
        destructive actions are disabled.
      </span>
    </div>
  )
}
