import { describe, it, expect } from "vitest"
import { render } from "@react-email/components"
import PaymentFailedEmail from "@/components/email/PaymentFailedEmail"

describe("PaymentFailedEmail", () => {
  it("renders without throwing given required props", async () => {
    const html = await render(
      <PaymentFailedEmail workspaceName="Acme" portalUrl="https://basekit.test/settings/billing" />,
    )
    expect(html).toContain("Your payment failed")
    expect(html).toContain("Acme")
  })

  it("includes the portal CTA URL", async () => {
    const html = await render(
      <PaymentFailedEmail workspaceName="Acme" portalUrl="https://basekit.test/settings/billing" />,
    )
    expect(html).toContain("https://basekit.test/settings/billing")
    expect(html).toContain("Update payment method")
  })

  it("omits the amount-due line when amountDue is missing", async () => {
    const without = await render(
      <PaymentFailedEmail workspaceName="Acme" portalUrl="https://basekit.test/settings/billing" />,
    )
    expect(without).not.toContain("Amount due")

    const withAmount = await render(
      <PaymentFailedEmail
        workspaceName="Acme"
        portalUrl="https://basekit.test/settings/billing"
        amountDue="$29.00"
      />,
    )
    expect(withAmount).toContain("Amount due")
    expect(withAmount).toContain("$29.00")
  })
})
