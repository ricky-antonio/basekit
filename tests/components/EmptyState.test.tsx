import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import EmptyState from "@/components/shared/EmptyState"

// next/link works without a router in jsdom
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe("EmptyState", () => {
  it("renders headline and body", () => {
    render(<EmptyState headline="No projects yet" body="Create one to get started." />)
    expect(screen.getByText("No projects yet")).toBeInTheDocument()
    expect(screen.getByText("Create one to get started.")).toBeInTheDocument()
  })

  it("renders the CTA as a link when actionLabel and actionHref are provided", () => {
    render(
      <EmptyState
        headline="No projects"
        actionLabel="Create project"
        actionHref="/projects/new"
      />,
    )
    const link = screen.getByRole("link", { name: "Create project" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/projects/new")
  })

  it("renders the CTA as a button and calls onAction when actionLabel is provided without href", async () => {
    const onAction = vi.fn()
    render(
      <EmptyState
        headline="No projects"
        actionLabel="Do something"
        onAction={onAction}
      />,
    )
    const button = screen.getByRole("button", { name: "Do something" })
    expect(button).toBeInTheDocument()
    await userEvent.click(button)
    expect(onAction).toHaveBeenCalledOnce()
  })

  it("does not render a CTA when actionLabel is not provided", () => {
    render(<EmptyState headline="Empty" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("renders the icon when provided", () => {
    render(<EmptyState headline="Empty" icon={<span data-testid="test-icon" />} />)
    expect(screen.getByTestId("test-icon")).toBeInTheDocument()
  })
})
