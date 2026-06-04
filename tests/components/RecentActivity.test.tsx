import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import RecentActivity from "@/components/admin/RecentActivity"
import type { AdminActivityRow } from "@/lib/admin-activity"

function row(overrides: Partial<AdminActivityRow> = {}): AdminActivityRow {
  return {
    id: "a1",
    workspaceId: "ws-1",
    actorId: "u1",
    impersonatorId: null,
    action: "project.created",
    targetType: "project",
    targetId: "p1",
    metadata: {},
    createdAt: "2026-06-01T12:30:00Z",
    ...overrides,
  }
}

describe("RecentActivity", () => {
  it("renders a humanized action label for each row", () => {
    render(<RecentActivity activities={[row({ id: "a1", action: "project.created" }), row({ id: "a2", action: "admin.plan_override", metadata: { from: "free", to: "pro", reason: "comped" } })]} />)
    expect(screen.getByText("Project created")).toBeInTheDocument()
    expect(screen.getByText("Plan override")).toBeInTheDocument()
  })

  it("surfaces a from → to · reason detail for plan overrides", () => {
    render(<RecentActivity activities={[row({ action: "admin.plan_override", metadata: { from: "free", to: "pro", reason: "comped" } })]} />)
    expect(screen.getByText("free → pro · comped")).toBeInTheDocument()
  })

  it("flags impersonated actions", () => {
    render(<RecentActivity activities={[row({ impersonatorId: "admin-9" })]} />)
    expect(screen.getByText("Impersonated")).toBeInTheDocument()
  })

  it("renders an empty state when there is no activity", () => {
    render(<RecentActivity activities={[]} />)
    expect(screen.getByText("No activity yet.")).toBeInTheDocument()
    expect(screen.queryByTestId("activity-row")).not.toBeInTheDocument()
  })

  it("accepts a custom title", () => {
    render(<RecentActivity activities={[]} title="Activity log" />)
    expect(screen.getByText("Activity log")).toBeInTheDocument()
  })
})
