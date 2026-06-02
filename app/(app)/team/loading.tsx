import { Skeleton } from "@/components/ui/skeleton"

export default function TeamLoading() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* PageHeader skeleton */}
      <div className="mb-8">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Member usage summary skeleton */}
      <div className="rounded-xl p-4 mb-6 flex items-center justify-between" style={{ border: "1px solid var(--border-default)" }}>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Member list skeleton */}
      <div className="rounded-xl p-4 space-y-4" style={{ border: "1px solid var(--border-default)" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
