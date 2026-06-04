import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PlanOverrideDialog from "@/components/admin/PlanOverrideDialog"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PlanOverrideDialog", () => {
  it("disables Confirm until both a plan and a reason are provided", async () => {
    render(<PlanOverrideDialog open onOpenChange={vi.fn()} currentPlan="free" onConfirm={vi.fn()} />)

    const confirm = screen.getByRole("button", { name: "Confirm override" })
    expect(confirm).toBeDisabled()

    await userEvent.selectOptions(screen.getByLabelText("New plan"), "pro")
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByLabelText("Reason"), "comped")
    expect(confirm).toBeEnabled()
  })

  it("calls onConfirm with the selected plan and trimmed reason", async () => {
    const onConfirm = vi.fn()
    render(<PlanOverrideDialog open onOpenChange={vi.fn()} currentPlan="free" onConfirm={onConfirm} />)

    await userEvent.selectOptions(screen.getByLabelText("New plan"), "enterprise")
    await userEvent.type(screen.getByLabelText("Reason"), "  vip  ")
    await userEvent.click(screen.getByRole("button", { name: "Confirm override" }))

    expect(onConfirm).toHaveBeenCalledWith("enterprise", "vip")
  })

  it("closes on Cancel without calling onConfirm", async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<PlanOverrideDialog open onOpenChange={onOpenChange} currentPlan="free" onConfirm={onConfirm} />)

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
