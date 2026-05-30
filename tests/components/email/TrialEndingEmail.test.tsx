import { describe, it, expect } from "vitest"
import { render } from "@react-email/components"
import TrialEndingEmail from "@/components/email/TrialEndingEmail"

describe("TrialEndingEmail", () => {
  it("renders without throwing given required props", async () => {
    const html = await render(
      <TrialEndingEmail workspaceName="Acme" portalUrl="https://basekit.test/settings/billing" />,
    )
    expect(html).toContain("3 days")
    expect(html).toContain("Acme")
  })

  it("includes the continue CTA URL", async () => {
    const html = await render(
      <TrialEndingEmail workspaceName="Acme" portalUrl="https://basekit.test/settings/billing" />,
    )
    expect(html).toContain("https://basekit.test/settings/billing")
    expect(html).toContain("Continue with Pro")
  })

  it("omits the trial-end date line when trialEndDate is missing", async () => {
    const without = await render(
      <TrialEndingEmail workspaceName="Acme" portalUrl="https://basekit.test/settings/billing" />,
    )
    expect(without).not.toContain("Trial ends on")

    const withDate = await render(
      <TrialEndingEmail
        workspaceName="Acme"
        portalUrl="https://basekit.test/settings/billing"
        trialEndDate="June 30, 2026"
      />,
    )
    expect(withDate).toContain("Trial ends on")
    expect(withDate).toContain("June 30, 2026")
  })
})
