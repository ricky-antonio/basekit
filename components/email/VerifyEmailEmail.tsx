import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout, emailStyles } from "./EmailLayout"

export interface VerifyEmailEmailProps {
  name?: string | null
  verifyUrl: string
}

export default function VerifyEmailEmail({ name, verifyUrl }: VerifyEmailEmailProps) {
  return (
    <EmailLayout preview="Confirm your email to finish setting up basekit.">
      <Heading style={emailStyles.heading}>Verify your email</Heading>
      <Text style={emailStyles.paragraph}>
        {name ? `Hi ${name}, c` : "C"}onfirm this is your email address to finish
        setting up your basekit account.
      </Text>
      <Section style={{ margin: "8px 0 8px" }}>
        <Button style={emailStyles.button} href={verifyUrl}>
          Verify email
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        This link expires in 1 hour. If you didn&apos;t create a basekit account, you
        can safely ignore this email.
      </Text>
    </EmailLayout>
  )
}
