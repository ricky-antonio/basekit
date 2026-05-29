import Sidebar from "@/components/layout/Sidebar"
import MobileNav from "@/components/layout/MobileNav"
import Topbar from "@/components/layout/Topbar"

interface AppShellProps {
  workspaceName: string
  displayName: string
  avatarUrl?: string | null
  children: React.ReactNode
}

export default function AppShell({
  workspaceName,
  displayName,
  avatarUrl,
  children,
}: AppShellProps) {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-app)" }}
    >
      {/* Skip to content (a11y) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[var(--z-toast)] focus:px-4 focus:py-2 focus:rounded-md focus:shadow-md"
        style={{
          background: "var(--brand-primary)",
          color: "var(--text-on-brand)",
          fontWeight: 600,
        }}
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <Sidebar workspaceName={workspaceName} />

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          workspaceName={workspaceName}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />

        {/* Scrollable content */}
        <main
          className="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8"
          id="main-content"
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
