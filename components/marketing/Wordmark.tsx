import Link from "next/link"
import { cn } from "@/lib/utils"

interface WordmarkProps {
  href?: string
  className?: string
  showIcon?: boolean
}

// The 3×3 grid of teal squares — "the building blocks of a SaaS".
function GridMark() {
  const cells = Array.from({ length: 9 })
  return (
    <span className="grid grid-cols-3 gap-[2px]" aria-hidden="true">
      {cells.map((_, i) => (
        <span
          key={i}
          className="block h-[3px] w-[3px] rounded-[1px]"
          style={{ background: "var(--brand-primary)" }}
        />
      ))}
    </span>
  )
}

export default function Wordmark({ href = "/", className, showIcon = true }: WordmarkProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 text-base tracking-tight select-none", className)}
      aria-label="basekit home"
    >
      {showIcon && <GridMark />}
      <span>
        <span className="font-normal" style={{ color: "var(--text-primary)" }}>
          base
        </span>
        <span
          className="font-extrabold"
          style={{ color: "var(--brand-primary)", letterSpacing: "-0.02em" }}
        >
          kit
        </span>
      </span>
    </Link>
  )
}
