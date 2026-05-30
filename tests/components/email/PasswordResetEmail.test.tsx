import { describe, it, expect } from "vitest"
import { render } from "@react-email/components"
import PasswordResetEmail from "@/components/email/PasswordResetEmail"

describe("PasswordResetEmail", () => {
  it("renders without throwing given required props", async () => {
    const html = await render(<PasswordResetEmail resetUrl="https://basekit.test/reset/xyz" />)
    expect(html).toContain("Reset your password")
  })

  it("includes the reset CTA URL and the 1-hour expiry note", async () => {
    const html = await render(<PasswordResetEmail resetUrl="https://basekit.test/reset/xyz" />)
    expect(html).toContain("https://basekit.test/reset/xyz")
    expect(html).toContain("Reset password")
    expect(html).toContain("1 hour")
  })

  it("omits the name greeting when name is missing", async () => {
    const withoutName = await render(
      <PasswordResetEmail resetUrl="https://basekit.test/reset/xyz" />,
    )
    expect(withoutName).not.toContain("Hi ")

    const withName = await render(
      <PasswordResetEmail name="Linus" resetUrl="https://basekit.test/reset/xyz" />,
    )
    expect(withName).toContain("Hi Linus,")
  })
})
