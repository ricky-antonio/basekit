import SignupForm from "./SignupForm"

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
