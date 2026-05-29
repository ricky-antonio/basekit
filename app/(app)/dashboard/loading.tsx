import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* PageHeader skeleton */}
      <div className="mb-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Workspace card skeleton */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Empty state skeleton */}
      <div
        className="rounded-xl py-16 px-6 flex flex-col items-center"
        style={{ border: "1px dashed var(--border-default)" }}
      >
        <Skeleton className="h-10 w-10 rounded-full mb-4" />
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  )
}
