import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Fictitious loopback Auth endpoint. Every browser Auth request is intercepted by the suite.
// No Supabase server, remote credentials or database lifecycle is involved.
const baseURL = "http://127.0.0.1:4349";
export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  outputDir: path.join(process.cwd(), ".data/auth-ux-results"),
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL, ...devices["Desktop Chrome"] },
  webServer: {
    command: "corepack pnpm dev --hostname 127.0.0.1 --port 4349",
    url: `${baseURL}/acceso`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DEMO_MODE: "false",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SITE_URL: "http://stale.invalid",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:57999",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fictitious_auth_ux",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
