// Presentation helpers for the admin UI. Pure functions, no I/O — shared so every
// admin surface formats money, percentages, and activity actions identically.

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

// Whole-dollar money (MRR/ARR are integer dollar amounts in this app).
export function formatCurrency(amount: number): string {
  return USD.format(amount)
}

// A 0–1 rate rendered as a percentage with one decimal (0.25 → "25.0%").
export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

const ACTION_LABELS: Record<string, string> = {
  "member.invited": "Member invited",
  "member.joined": "Member joined",
  "member.removed": "Member removed",
  "member.role_changed": "Role changed",
  "subscription.upgraded": "Subscription upgraded",
  "subscription.downgraded": "Subscription downgraded",
  "subscription.canceled": "Subscription canceled",
  "project.created": "Project created",
  "project.deleted": "Project deleted",
  "workspace.created": "Workspace created",
  "workspace.updated": "Workspace updated",
  "admin.plan_override": "Plan override",
  "admin.impersonation_started": "Impersonation started",
  "admin.impersonation_ended": "Impersonation ended",
}

// Known actions get a curated label; anything else degrades to a readable
// title-cased form of the raw action string rather than showing a dotted slug.
export function humanizeAction(action: string): string {
  const known = ACTION_LABELS[action]
  if (known) return known
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

// Activity actions worth offering as a filter, in display order.
export const FILTERABLE_ACTIONS = Object.keys(ACTION_LABELS)
