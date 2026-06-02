import type { WorkspaceMemberRole } from "@/lib/types"

// Owner = brand, Admin = info, Member = neutral. Color is never the only signal —
// the uppercase text label carries the meaning (code.md: no color-only state).
const ROLE_STYLES: Record<WorkspaceMemberRole, React.CSSProperties> = {
  owner: {
    background: "var(--brand-bg-soft)",
    color: "var(--brand-primary)",
    border: "1px solid var(--brand-border-soft)",
  },
  admin: {
    background: "var(--info-bg)",
    color: "var(--info-text)",
    border: "1px solid var(--info-border)",
  },
  member: {
    background: "var(--bg-surface-hover)",
    color: "var(--text-secondary)",
    border: "1px solid transparent",
  },
}

export default function RoleBadge({ role }: { role: WorkspaceMemberRole }) {
  return (
    <span
      data-role={role}
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ ...ROLE_STYLES[role], borderRadius: "var(--radius-sm)" }}
    >
      {role.toUpperCase()}
    </span>
  )
}
