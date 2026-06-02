import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AcceptInvitation from "@/components/team/AcceptInvitation"

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }))
const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

function mockPreview(preview: unknown) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => preview }) as unknown as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AcceptInvitation", () => {
  it("renders the accept card for a valid invitation", async () => {
    mockPreview({ status: "valid", workspaceName: "Acme", inviterName: "Ada", email: "x@y.com", role: "member" })
    render(<AcceptInvitation token="tok" isAuthenticated />)

    expect(await screen.findByText("Acme")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeInTheDocument()
  })

  it("shows a terminal message for an expired invitation", async () => {
    mockPreview({ status: "expired", workspaceName: null, inviterName: null, email: null, role: null })
    render(<AcceptInvitation token="tok" isAuthenticated />)

    expect(await screen.findByText(/this invitation has expired/i)).toBeInTheDocument()
  })

  it("posts to the accept route and navigates to the dashboard on accept", async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "valid", workspaceName: "Acme", inviterName: "Ada", email: "x@y.com", role: "member" }),
    })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ workspaceId: "ws-1", role: "member" }) })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AcceptInvitation token="tok" isAuthenticated />)
    await userEvent.click(await screen.findByRole("button", { name: "Accept invitation" }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(fetchMock).toHaveBeenLastCalledWith("/api/team/accept", expect.objectContaining({ method: "POST" }))
  })

  it("shows a signup CTA when the visitor is unauthenticated", async () => {
    mockPreview({ status: "valid", workspaceName: "Acme", inviterName: "Ada", email: "x@y.com", role: "member" })
    render(<AcceptInvitation token="tok" isAuthenticated={false} />)

    const cta = await screen.findByRole("link", { name: "Create an account to join" })
    expect(cta).toHaveAttribute("href", "/signup?invite=tok&email=x%40y.com")
  })
})
