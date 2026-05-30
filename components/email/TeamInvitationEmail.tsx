import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout, emailStyles } from "./EmailLayout"

export interface TeamInvitationEmailProps {
  inviterName: string
  workspaceName: string
  acceptUrl: string
  message?: string | null
}

export default function TeamInvitationEmail({
  inviterName,
  workspaceName,
  acceptUrl,
  message,
}: TeamInvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to join ${workspaceName} on basekit.`}
    >
      <Heading style={emailStyles.heading}>You&apos;ve been invited</Heading>
      <Text style={emailStyles.paragraph}>
        <strong>{inviterName}</strong> invited you to join{" "}
        <strong>{workspaceName}</strong> on basekit. Accept the invitation to get
        access to the workspace.
      </Text>
      {message ? (
        <Text style={emailStyles.paragraph}>
          &ldquo;{message}&rdquo;
        </Text>
      ) : null}
      <Section style={{ margin: "8px 0 8px" }}>
        <Button style={emailStyles.button} href={acceptUrl}>
          Accept invitation
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        This invitation expires in 7 days. If you weren&apos;t expecting it, you can
        ignore this email.
      </Text>
    </EmailLayout>
  )
}
