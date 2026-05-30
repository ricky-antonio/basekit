import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout, emailStyles } from "./EmailLayout"

export interface TrialEndingEmailProps {
  workspaceName: string
  portalUrl: string
  trialEndDate?: string | null
}

export default function TrialEndingEmail({
  workspaceName,
  portalUrl,
  trialEndDate,
}: TrialEndingEmailProps) {
  return (
    <EmailLayout preview={`Your basekit Pro trial for ${workspaceName} ends in 3 days.`}>
      <Heading style={emailStyles.heading}>Your trial ends in 3 days</Heading>
      <Text style={emailStyles.paragraph}>
        Your Pro trial for <strong>{workspaceName}</strong> ends in 3 days. To keep
        unlimited projects and your team seats, continue with Pro — no action is needed
        if your card is already on file.
      </Text>
      {trialEndDate ? (
        <Text style={emailStyles.paragraph}>
          Trial ends on <strong>{trialEndDate}</strong>.
        </Text>
      ) : null}
      <Section style={{ margin: "8px 0 8px" }}>
        <Button style={emailStyles.button} href={portalUrl}>
          Continue with Pro
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Don&apos;t want to continue? You can cancel anytime before the trial ends and
        you won&apos;t be charged.
      </Text>
    </EmailLayout>
  )
}
