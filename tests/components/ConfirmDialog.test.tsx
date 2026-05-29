import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ConfirmDialog from "@/components/shared/ConfirmDialog"

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Confirm action",
    description: "Are you sure you want to do this?",
    onConfirm: vi.fn(),
  }
  return render(<ConfirmDialog {...defaults} {...props} />)
}

describe("ConfirmDialog", () => {
  it("renders title and description", () => {
    renderDialog()
    expect(screen.getByText("Confirm action")).toBeInTheDocument()
    expect(screen.getByText("Are you sure you want to do this?")).toBeInTheDocument()
  })

  it("calls onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("calls onOpenChange(false) when cancel is clicked", async () => {
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange })
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows custom confirmLabel and cancelLabel", () => {
    renderDialog({ confirmLabel: "Yes, delete", cancelLabel: "Go back" })
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument()
  })

  it("closes on Escape key", async () => {
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange })
    await userEvent.keyboard("{Escape}")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
