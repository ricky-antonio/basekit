import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { CSSProperties, ReactNode } from "react"

// Email clients cannot read CSS variables, so the design-system palette is
// inlined here as literal hex values (the single allowed place to hardcode them).
const palette = {
  background: "#FAFAF9",
  surface: "#FFFFFF",
  textPrimary: "#0A0A0A",
  textSecondary: "#57534E",
  textMuted: "#A8A29E",
  brand: "#0D9488",
  border: "#E7E5E4",
} as const

const fontStack =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const bodyStyle: CSSProperties = {
  backgroundColor: palette.background,
  fontFamily: fontStack,
  margin: 0,
  padding: 0,
}

const containerStyle: CSSProperties = {
  backgroundColor: palette.surface,
  border: `1px solid ${palette.border}`,
  borderRadius: "12px",
  margin: "40px auto",
  padding: "32px",
  maxWidth: "600px",
}

const wordmarkStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 400,
  letterSpacing: "-0.02em",
  color: palette.textPrimary,
  margin: "0 0 24px",
}

const hrStyle: CSSProperties = {
  borderColor: palette.border,
  margin: "32px 0 16px",
}

const footerStyle: CSSProperties = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: palette.textSecondary,
  margin: "0 0 4px",
}

const footerMutedStyle: CSSProperties = {
  fontSize: "12px",
  lineHeight: "1.5",
  color: palette.textMuted,
  margin: 0,
}

// Shared text/CTA styles so every template renders identically. Imported by the
// six templates rather than re-declared per file.
export const emailStyles = {
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: palette.textPrimary,
    lineHeight: "1.25",
    margin: "0 0 16px",
  } satisfies CSSProperties,
  paragraph: {
    fontSize: "15px",
    lineHeight: "1.65",
    color: palette.textSecondary,
    margin: "0 0 16px",
  } satisfies CSSProperties,
  button: {
    backgroundColor: palette.brand,
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
    borderRadius: "9px",
    padding: "12px 20px",
    display: "inline-block",
  } satisfies CSSProperties,
  muted: {
    fontSize: "13px",
    lineHeight: "1.6",
    color: palette.textMuted,
    margin: "16px 0 0",
  } satisfies CSSProperties,
  link: {
    color: palette.brand,
    textDecoration: "underline",
  } satisfies CSSProperties,
}

export interface EmailLayoutProps {
  preview: string
  children: ReactNode
}

// Named export is what the six templates import; the default export exists so the
// react-email preview server (which renders each file's default) shows the shared
// chrome instead of a "no default export" error.
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section>
            <Text style={wordmarkStyle}>
              base
              <span style={{ color: palette.brand, fontWeight: 800 }}>kit</span>
            </Text>
          </Section>
          {children}
          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            basekit — the foundation every SaaS needs to ship.
          </Text>
          <Text style={footerMutedStyle}>
            You&apos;re receiving this because you have a basekit account.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailLayout
