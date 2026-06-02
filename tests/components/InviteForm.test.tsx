import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import toast from "react-hot-toast"
import InviteForm from "@/components/team/InviteForm"

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

function mockFetch(ok: boolean, body: unknown = {}) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("InviteForm", () => {
  it("validates the email format on blur", async () => {
    render(<InviteForm />)
    const input = screen.getByLabelText("Email address")
    await userEvent.type(input, "not-an-email")
    await userEvent.tab()
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument()
  })

  it("submits with the default role of 'member'", async () => {
    const fetchMock = mockFetch(true)
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText("Email address"), "new@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string)
    expect(body).toEqual({ email: "new@example.com", role: "member" })
  })

  it("shows the UpgradePrompt when the server returns LIMIT_EXCEEDED", async () => {
    mockFetch(false, { error: "You've reached the member limit.", code: "LIMIT_EXCEEDED", upgradeUrl: "/settings/billing" })
    render(<InviteForm currentPlanLabel="Free" />)

    await userEvent.type(screen.getByLabelText("Email address"), "new@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }))

    expect(await screen.findByText(/reached your plan limit/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /upgrade plan/i })).toBeInTheDocument()
  })

  it("clears the email field on success", async () => {
    mockFetch(true)
    render(<InviteForm />)

    const input = screen.getByLabelText("Email address")
    await userEvent.type(input, "new@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }))

    await waitFor(() => expect(input).toHaveValue(""))
    expect(refresh).toHaveBeenCalled()
  })

  it("shows an error toast on a server failure", async () => {
    mockFetch(false, { error: "That person is already a member.", code: "VALIDATION_ERROR" })
    render(<InviteForm />)

    await userEvent.type(screen.getByLabelText("Email address"), "new@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That person is already a member."))
  })

  it("shows 'Inviting…' and disables the button while submitting", async () => {
    let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void = () => {}
    global.fetch = vi.fn(
      () => new Promise((resolve) => { resolveFetch = resolve }),
    ) as unknown as typeof fetch

    render(<InviteForm />)
    await userEvent.type(screen.getByLabelText("Email address"), "new@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }))

    const button = await screen.findByRole("button", { name: "Inviting…" })
    expect(button).toBeDisabled()

    resolveFetch({ ok: true, json: async () => ({}) })
    await waitFor(() => expect(screen.getByRole("button", { name: "Send invitation" })).toBeEnabled())
  })
})
