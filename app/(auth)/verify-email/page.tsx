import Link from "next/link"
import { IconMail } from "@tabler/icons-react"

export default function VerifyEmailPage() {
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "var(--brand-bg-soft)" }}
      >
        <IconMail size={24} style={{ color: "var(--brand-primary)" }} aria-hidden="true" />
      </div>

      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        Check your inbox
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        We sent a verification link to your email address. Click the link to activate your account.
      </p>

      <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
        Didn&apos;t receive it?{" "}
        <Link
          href="/signup"
          className="font-medium hover:underline"
          style={{ color: "var(--brand-primary)" }}
        >
          Try again
        </Link>
      </p>
    </div>
  )
}
