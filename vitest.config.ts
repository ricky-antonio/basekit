import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/**/*.ts", "app/api/**/*.ts", "components/**/*.tsx"],
      exclude: [
        "**/*.d.ts",
        "**/types.ts",
        "**/index.ts",
        "lib/supabase/client.ts",
        "lib/supabase/server.ts",
        "lib/supabase/middleware.ts",
        "lib/stripe/client.ts",
        "lib/resend.ts",
        "lib/utils.ts",
        "lib/database.types.ts",
        "components/ui/**",
        "app/api/sentry-example-api/**",
      ],
      thresholds: {
        lines: 78,
        functions: 78,
        branches: 73,
        statements: 78,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
