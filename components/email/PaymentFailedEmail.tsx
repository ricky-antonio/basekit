import { Button, Heading, Section, Text } from "@react-email/components"
import { EmailLayout, emailStyles } from "./EmailLayout"

export interface PaymentFailedEmailProps {
  workspaceName: string
  portalUrl: string
  amountDue?: string | null
}

export default function PaymentFailedEmail({
  workspaceName,
  portalUrl,
  amountDue,
}: PaymentFailedEmailProps) {
  return (
    <EmailLayout preview={`We couldn't process the payment for ${workspaceName}.`}>
      <Heading style={emailStyles.heading}>Your payment failed</Heading>
      <Text style={emailStyles.paragraph}>
        We couldn&apos;t process the latest payment for{" "}
        <strong>{workspaceName}</strong>. Your subscription is now past due — update
        your payment method to keep your Pro features active.
      </Text>
      {amountDue ? (
        <Text style={emailStyles.paragraph}>
          Amount due: <strong>{amountDue}</strong>
        </Text>
      ) : null}
      <Section style={{ margin: "8px 0 8px" }}>
        <Button style={emailStyles.button} href={portalUrl}>
          Update payment method
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Stripe will retry automatically, but updating your card now avoids any
        interruption.
      </Text>
    </EmailLayout>
  )
}
