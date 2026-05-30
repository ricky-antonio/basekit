import { describe, it, expect } from "vitest"
import { render } from "@react-email/components"
import VerifyEmailEmail from "@/components/email/VerifyEmailEmail"

describe("VerifyEmailEmail", () => {
  it("renders without throwing given required props", async () => {
    const html = await render(<VerifyEmailEmail verifyUrl="https://basekit.test/verify/abc" />)
    expect(html).toContain("Verify your email")
  })

  it("includes the verify CTA URL", async () => {
    const html = await render(<VerifyEmailEmail verifyUrl="https://basekit.test/verify/abc" />)
    expect(html).toContain("https://basekit.test/verify/abc")
    expect(html).toContain("Verify email")
  })

  it("omits the name greeting when name is missing", async () => {
    const withoutName = await render(
      <VerifyEmailEmail verifyUrl="https://basekit.test/verify/abc" />,
    )
    expect(withoutName).not.toContain("Hi ")

    const withName = await render(
      <VerifyEmailEmail name="Grace" verifyUrl="https://basekit.test/verify/abc" />,
    )
    expect(withName).toContain("Hi Grace,")
  })
})
