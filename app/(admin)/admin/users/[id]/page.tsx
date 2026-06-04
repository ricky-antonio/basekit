import Link from "next/link"
import { IconArrowLeft } from "@tabler/icons-react"
import UserDetail from "@/components/admin/UserDetail"

export const metadata = { title: "User — admin — basekit" }

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        <IconArrowLeft size={15} aria-hidden="true" />
        Back to users
      </Link>
      <UserDetail userId={id} />
    </div>
  )
}
