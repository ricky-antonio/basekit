import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ toastSuccess: vi.fn(), replace: vi.fn() }))

vi.mock("react-hot-toast", () => ({ default: { success: mocks.toastSuccess } }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }))

import UpgradedToast from "@/app/(app)/settings/billing/UpgradedToast"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("UpgradedToast", () => {
  it("fires a single success toast with a stable id", () => {
    render(<UpgradedToast />)
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1)
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Welcome to Pro"),
      expect.objectContaining({ id: "upgraded-to-pro" }),
    )
  })

  it("strips the ?upgraded=true param after firing", () => {
    render(<UpgradedToast />)
    expect(mocks.replace).toHaveBeenCalledWith("/settings/billing")
  })
})
