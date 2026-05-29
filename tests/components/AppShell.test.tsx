import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AppShell from "@/components/layout/AppShell"

// Stub next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

// Stub next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Stub next-themes
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: "light", setTheme: vi.fn() })),
}))

// Stub the sign-out server action used by Topbar
vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: vi.fn().mockResolvedValue(undefined),
}))

const defaultProps = {
  workspaceName: "Acme Corp",
  displayName: "Alice",
  avatarUrl: null,
  children: <div>page content</div>,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AppShell", () => {
  it("renders the sidebar on desktop (hidden class present for mobile)", () => {
    render(<AppShell {...defaultProps} />)
    // Sidebar has class hidden lg:flex — check it renders and contains workspace name
    const sidebar = screen.getByRole("complementary", { name: "Sidebar navigation" })
    expect(sidebar).toBeInTheDocument()
    expect(sidebar).toHaveClass("hidden")
  })

  it("renders the mobile bottom nav", () => {
    render(<AppShell {...defaultProps} />)
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" })
    expect(nav).toBeInTheDocument()
  })

  it("highlights the active nav item based on pathname", () => {
    render(<AppShell {...defaultProps} />)
    // The Dashboard link in sidebar should have aria-current=page
    const dashboardLinks = screen.getAllByRole("link", { name: /Dashboard/i })
    expect(dashboardLinks.some((l) => l.getAttribute("aria-current") === "page")).toBe(true)
  })

  it("renders the workspace name in the sidebar", () => {
    render(<AppShell {...defaultProps} />)
    // The workspace name appears in the sidebar as a truncated label
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThan(0)
  })

  it("opens the user menu on avatar click", async () => {
    render(<AppShell {...defaultProps} />)
    const menuButton = screen.getByRole("button", { name: "User menu" })
    await userEvent.click(menuButton)
    expect(screen.getByRole("menuitem", { name: /Settings/i })).toBeInTheDocument()
  })

  it("renders page content", () => {
    render(<AppShell {...defaultProps} />)
    expect(screen.getByText("page content")).toBeInTheDocument()
  })
})
