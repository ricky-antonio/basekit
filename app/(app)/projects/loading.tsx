import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectsLoading() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* PageHeader + action skeleton */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-11 w-32" />
      </div>

      {/* Usage summary skeleton */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Project card skeletons */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ border: "1px solid var(--border-default)" }}
          >
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
