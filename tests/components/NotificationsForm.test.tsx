import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import toast from "react-hot-toast"
import NotificationsForm from "@/app/(app)/settings/notifications/NotificationsForm"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notifications"
import type { NotificationPreferences } from "@/lib/types"

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const updateAction = vi.fn()
vi.mock("@/app/(app)/settings/actions", () => ({
  updateNotificationPreferencesAction: (...args: unknown[]) => updateAction(...args),
}))

const allOn: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("NotificationsForm", () => {
  it("renders a labelled toggle for every notification kind", () => {
    render(<NotificationsForm initialPreferences={allOn} />)

    expect(screen.getByText("Weekly digest")).toBeInTheDocument()
    expect(screen.getByText("Payment failures")).toBeInTheDocument()
    expect(screen.getByText("Trial reminders")).toBeInTheDocument()
    expect(screen.getByText("New members")).toBeInTheDocument()
    expect(screen.getByText("Plan changes")).toBeInTheDocument()
    expect(screen.getAllByRole("switch")).toHaveLength(5)
  })

  it("disables Save until a preference changes", async () => {
    render(<NotificationsForm initialPreferences={allOn} />)

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()

    await userEvent.click(screen.getByRole("switch", { name: "Weekly digest" }))
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled()
  })

  it("submits only the toggled-off draft and shows a success toast", async () => {
    updateAction.mockResolvedValue({
      ok: true,
      data: { ...allOn, weekly_digest: false },
    })
    render(<NotificationsForm initialPreferences={allOn} />)

    await userEvent.click(screen.getByRole("switch", { name: "Weekly digest" }))
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(updateAction).toHaveBeenCalled())
    expect(updateAction.mock.calls[0]?.[0]).toMatchObject({ weekly_digest: false, payment_failed: true })
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Notification preferences saved."),
    )
    // After save, the form is no longer dirty
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
  })

  it("shows an error toast and stays dirty when the save fails", async () => {
    updateAction.mockResolvedValue({
      ok: false,
      error: { error: "Could not save.", code: "INTERNAL_ERROR" },
    })
    render(<NotificationsForm initialPreferences={allOn} />)

    await userEvent.click(screen.getByRole("switch", { name: "Payment failures" }))
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save."))
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled()
  })
})
