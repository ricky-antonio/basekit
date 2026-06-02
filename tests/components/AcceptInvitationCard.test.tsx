import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AcceptInvitationCard from "@/components/team/AcceptInvitationCard"

const baseProps = {
  workspaceName: "Acme",
  inviterName: "Ada Owner",
  isAuthenticated: true,
  accepting: false,
  signupHref: "/signup?invite=tok&email=invitee%40example.com",
  onAccept: vi.fn(),
  onDecline: vi.fn(),
}

describe("AcceptInvitationCard", () => {
  it("renders the workspace name and inviter name", () => {
    render(<AcceptInvitationCard {...baseProps} />)
    expect(screen.getByText("Acme")).toBeInTheDocument()
    expect(screen.getByText(/Ada Owner invited you/)).toBeInTheDocument()
  })

  it("Accept button calls the accept action", async () => {
    const onAccept = vi.fn()
    render(<AcceptInvitationCard {...baseProps} onAccept={onAccept} />)
    await userEvent.click(screen.getByRole("button", { name: "Accept invitation" }))
    expect(onAccept).toHaveBeenCalledOnce()
  })

  it("Decline button discards the invitation", async () => {
    const onDecline = vi.fn()
    render(<AcceptInvitationCard {...baseProps} onDecline={onDecline} />)
    await userEvent.click(screen.getByRole("button", { name: "Decline" }))
    expect(onDecline).toHaveBeenCalledOnce()
  })

  it("offers a create-account CTA when the visitor is not authenticated", () => {
    render(<AcceptInvitationCard {...baseProps} isAuthenticated={false} />)
    const cta = screen.getByRole("link", { name: "Create an account to join" })
    expect(cta).toHaveAttribute("href", baseProps.signupHref)
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument()
  })

  it("shows 'Joining…' on the Accept button while accepting", () => {
    render(<AcceptInvitationCard {...baseProps} accepting />)
    expect(screen.getByRole("button", { name: "Joining…" })).toBeDisabled()
  })
})
