import type { Metadata } from "next"
import SignupForm from "./SignupForm"

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your basekit workspace and start shipping.",
}

// Server wrapper so the invite token + prefill email arrive as props (read from the
// query) rather than via a client useSearchParams + Suspense boundary.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; email?: string }>
}) {
  const { invite, email } = await searchParams
  return <SignupForm invite={invite} prefillEmail={email} />
}
