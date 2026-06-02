"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

interface AcceptInvitationCardProps {
  workspaceName: string | null
  inviterName: string | null
  isAuthenticated: boolean
  accepting: boolean
  signupHref: string
  onAccept: () => void
  onDecline: () => void
}

export default function AcceptInvitationCard({
  workspaceName,
  inviterName,
  isAuthenticated,
  accepting,
  signupHref,
  onAccept,
  onDecline,
}: AcceptInvitationCardProps) {
  const workspace = workspaceName ?? "a workspace"

  return (
    <div
      className="rounded-xl p-6 text-center"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
    >
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
        You&rsquo;ve been invited
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        {inviterName ? `${inviterName} invited you` : "You've been invited"} to join{" "}
        <strong style={{ color: "var(--text-primary)" }}>{workspace}</strong> on basekit.
      </p>

      {isAuthenticated ? (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={onAccept} disabled={accepting} className="min-h-11">
            {accepting ? "Joining…" : "Accept invitation"}
          </Button>
          <Button variant="ghost" onClick={onDecline} disabled={accepting} className="min-h-11">
            Decline
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <Button asChild className="min-h-11 w-full">
            <Link href={signupHref}>Create an account to join</Link>
          </Button>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "var(--brand-primary)" }}>
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
