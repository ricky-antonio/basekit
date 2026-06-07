import { describe, it, expect } from "vitest"
import sitemap from "@/app/sitemap"
import robots from "@/app/robots"

describe("sitemap", () => {
  const entries = sitemap()
  const urls = entries.map((entry) => entry.url)

  it("includes public marketing routes", () => {
    expect(urls).toContain("http://localhost:3000")
    expect(urls).toContain("http://localhost:3000/pricing")
  })

  it("includes public auth entry points", () => {
    expect(urls).toContain("http://localhost:3000/login")
    expect(urls).toContain("http://localhost:3000/signup")
  })

  it("excludes /dashboard and /admin", () => {
    expect(urls.some((url) => url.includes("/dashboard"))).toBe(false)
    expect(urls.some((url) => url.includes("/admin"))).toBe(false)
  })

  it("gives the homepage the highest priority", () => {
    const home = entries.find((entry) => entry.url === "http://localhost:3000")
    expect(home?.priority).toBe(1)
  })
})

describe("robots", () => {
  const config = robots()

  it("allows the public root", () => {
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules
    expect(rule?.allow).toBe("/")
  })

  it("disallows authenticated surfaces", () => {
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules
    const disallow = rule?.disallow
    const list = Array.isArray(disallow) ? disallow : disallow ? [disallow] : []
    expect(list).toContain("/dashboard")
    expect(list).toContain("/admin")
  })

  it("references the sitemap", () => {
    expect(config.sitemap).toBe("http://localhost:3000/sitemap.xml")
  })
})
