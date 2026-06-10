import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "react-hot-toast"
import TopProgressBar from "@/components/layout/TopProgressBar"
import "./globals.css"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
})

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "basekit — The foundation every SaaS needs to ship",
    template: "%s · basekit",
  },
  description:
    "basekit is the production-ready SaaS foundation — auth, workspaces, Stripe billing, team management, and admin tooling, ready to ship.",
  applicationName: "basekit",
  keywords: ["SaaS boilerplate", "Next.js starter", "Supabase", "Stripe billing", "SaaS foundation"],
  authors: [{ name: "basekit" }],
  openGraph: {
    type: "website",
    siteName: "basekit",
    url: SITE_URL,
    title: "basekit — The foundation every SaaS needs to ship",
    description:
      "Auth, workspaces, Stripe billing, team management, and admin tooling — the foundation every SaaS needs to ship.",
  },
  twitter: {
    card: "summary_large_image",
    title: "basekit — The foundation every SaaS needs to ship",
    description: "The foundation every SaaS needs to ship.",
  },
  // Icons auto-detected from app/icon.svg (favicon) + app/apple-icon.tsx (iOS).
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TopProgressBar />
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
