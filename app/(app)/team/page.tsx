import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { listMembers } from "@/lib/team"
import { listPendingInvitations } from "@/lib/invitations"
import { getUsage } from "@/lib/usage"
import { getActivePlan } from "@/lib/billing"
import { PLANS } from "@/lib/plans"
import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import InviteForm from "@/components/team/InviteForm"
import TeamMembers from "@/components/team/TeamMembers"
import PendingInviteRow from "@/components/team/PendingInviteRow"
import { IconUsersGroup } from "@tabler/icons-react"

export const metadata = { title: "Team" }

export default async function TeamPage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) redirect("/no-workspace")
  const workspace = workspaceResult.data

  const [membersResult, plan, usageResult, pendingResult] = await Promise.all([
    listMembers(workspace.id),
    getActivePlan(workspace.id),
    getUsage(workspace.id, "members"),
    listPendingInvitations(workspace.id),
  ])

  const currentRole = membersResult.ok
    ? membersResult.data.find((m) => m.userId === authResult.data.id)?.role
    : undefined
  const canManage = currentRole === "owner" || currentRole === "admin"

  const planLabel = PLANS[plan].label
  const limit = PLANS[plan].memberLimit
  const used = usageResult.ok ? usageResult.data : membersResult.ok ? membersResult.data.length : 1
  const pending = pendingResult.ok ? pendingResult.data : []
  const isSoloTeam = used <= 1 && pending.length === 0

  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHeader title="Team" subtitle="Manage your workspace members and invitations." />

      {/* Member usage summary */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center justify-between text-sm"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <span style={{ color: "var(--text-secondary)" }}>Members</span>
        <span style={{ color: "var(--text-primary)" }} className="font-medium">
          {limit === null ? `${used} · Unlimited` : `${used} of ${limit}`}
        </span>
      </div>

      {canManage && isSoloTeam && (
        <div className="mb-8">
          <EmptyState
            icon={<IconUsersGroup size={40} />}
            headline="Build your team"
            body={`You're the only one in ${workspace.name}. Invite teammates to collaborate on projects together.`}
            actionLabel="Invite a teammate"
            actionHref="#invite-teammate"
          />
        </div>
      )}

      {canManage && (
        <section id="invite-teammate" className="mb-8 scroll-mt-20">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Invite a teammate
          </h2>
          <InviteForm currentPlanLabel={planLabel} />
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          Members
        </h2>
        <TeamMembers />
      </section>

      {canManage && pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Pending invitations
          </h2>
          <ul
            className="rounded-xl overflow-hidden divide-y"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderColor: "var(--border-default)" }}
          >
            {pending.map((invitation) => (
              <PendingInviteRow key={invitation.id} invitation={invitation} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
