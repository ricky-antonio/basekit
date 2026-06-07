import type { MetadataRoute } from "next"

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"

// Only public, indexable routes belong here. App + admin surfaces are gated behind
// auth and explicitly noindex'd, so they are deliberately excluded.
const PUBLIC_ROUTES = ["/", "/pricing", "/login", "/signup"] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route === "/" ? "" : route}`,
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }))
}
