import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout, emailStyles } from "./EmailLayout"

export interface PasswordResetEmailProps {
  name?: string | null
  resetUrl: string
}

export default function PasswordResetEmail({ name, resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your basekit password.">
      <Heading style={emailStyles.heading}>Reset your password</Heading>
      <Text style={emailStyles.paragraph}>
        {name ? `Hi ${name}, w` : "W"}e received a request to reset the password for
        your basekit account. Click below to choose a new one.
      </Text>
      <Section style={{ margin: "8px 0 8px" }}>
        <Button style={emailStyles.button} href={resetUrl}>
          Reset password
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        This link expires in 1 hour and can be used once. If you didn&apos;t request a
        password reset, you can safely ignore this email — your password won&apos;t
        change.
      </Text>
    </EmailLayout>
  )
}
