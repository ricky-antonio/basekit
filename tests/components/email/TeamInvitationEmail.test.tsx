import { describe, it, expect } from "vitest"
import { render } from "@react-email/components"
import TeamInvitationEmail from "@/components/email/TeamInvitationEmail"

describe("TeamInvitationEmail", () => {
  it("renders without throwing given required props", async () => {
    const html = await render(
      <TeamInvitationEmail
        inviterName="Ada Lovelace"
        workspaceName="Analytical Engine"
        acceptUrl="https://basekit.test/team/accept/token-123"
      />,
    )
    expect(html).toContain("You")
    expect(html).toContain("Ada Lovelace")
    expect(html).toContain("Analytical Engine")
  })

  it("includes the accept CTA URL", async () => {
    const html = await render(
      <TeamInvitationEmail
        inviterName="Ada Lovelace"
        workspaceName="Analytical Engine"
        acceptUrl="https://basekit.test/team/accept/token-123"
      />,
    )
    expect(html).toContain("https://basekit.test/team/accept/token-123")
    expect(html).toContain("Accept invitation")
  })

  it("omits the personal message block when message is missing", async () => {
    const without = await render(
      <TeamInvitationEmail
        inviterName="Ada Lovelace"
        workspaceName="Analytical Engine"
        acceptUrl="https://basekit.test/team/accept/token-123"
      />,
    )
    expect(without).not.toContain("Join us")

    const withMessage = await render(
      <TeamInvitationEmail
        inviterName="Ada Lovelace"
        workspaceName="Analytical Engine"
        acceptUrl="https://basekit.test/team/accept/token-123"
        message="Join us"
      />,
    )
    expect(withMessage).toContain("Join us")
  })
})
