import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout, emailStyles } from "./EmailLayout"

export interface WelcomeEmailProps {
  name?: string | null
  dashboardUrl: string
}

export default function WelcomeEmail({ name, dashboardUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to basekit — your workspace is ready.">
      <Heading style={emailStyles.heading}>Welcome to basekit</Heading>
      <Text style={emailStyles.paragraph}>
        {name ? `Hi ${name},` : "Hi there,"} your workspace is ready. basekit gives
        you auth, billing, teams, and the rest of the SaaS foundation out of the box —
        so you can start building the part that&apos;s actually yours.
      </Text>
      <Section style={{ margin: "8px 0 8px" }}>
        <Button style={emailStyles.button} href={dashboardUrl}>
          Go to dashboard
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Need a hand? Just reply to this email.
      </Text>
    </EmailLayout>
  )
}
