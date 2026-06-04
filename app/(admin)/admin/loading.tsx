import { Skeleton } from "@/components/ui/skeleton"

// Route-level skeleton for the admin section while the page's data components mount.
export default function AdminLoading() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-[316px] w-full rounded-xl" />
    </div>
  )
}
