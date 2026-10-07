import { defineConfig, devices } from "@playwright/test";

const port = 4317;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // This suite requires local Supabase credentials and owns a destructive local fixture lifecycle.
  // It has its own config/runner and must not be discovered by the demo-only E2E gate.
  testIgnore: [
    "**/checkout-connected/**",
    "**/connected-domains/**",
    "**/ux-audit/roles.spec.ts",
    "**/ux-audit/customer-b2b.spec.ts",
  ],
  outputDir: ".data/playwright-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `corepack pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DEMO_MODE: "true",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
