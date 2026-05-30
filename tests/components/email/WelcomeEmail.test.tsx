import { describe, it, expect } from "vitest"
import { render } from "@react-email/components"
import WelcomeEmail from "@/components/email/WelcomeEmail"

// Email templates are full HTML documents, so we assert on the rendered HTML
// string (react-email's render) rather than mounting them in jsdom via RTL.
describe("WelcomeEmail", () => {
  it("renders without throwing given required props", async () => {
    const html = await render(<WelcomeEmail dashboardUrl="https://basekit.test/dashboard" />)
    expect(html).toContain("Welcome to basekit")
  })

  it("includes the dashboard CTA URL", async () => {
    const html = await render(<WelcomeEmail dashboardUrl="https://basekit.test/dashboard" />)
    expect(html).toContain("https://basekit.test/dashboard")
    expect(html).toContain("Go to dashboard")
  })

  it("greets by name when provided and falls back when missing", async () => {
    const withName = await render(
      <WelcomeEmail name="Ada" dashboardUrl="https://basekit.test/dashboard" />,
    )
    expect(withName).toContain("Hi Ada,")

    const withoutName = await render(
      <WelcomeEmail dashboardUrl="https://basekit.test/dashboard" />,
    )
    expect(withoutName).not.toContain("Hi Ada,")
    expect(withoutName).toContain("Hi there,")
  })
})
