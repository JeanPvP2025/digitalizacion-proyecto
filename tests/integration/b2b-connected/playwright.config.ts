import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = "http://127.0.0.1:4323";
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:56401") {
  throw new Error("Run the isolated B2B runner; this suite only permits Supabase on loopback port 56401.");
}

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: path.join(process.cwd(), ".data/b2b-connected-results"),
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL, ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: {
    command: "corepack pnpm dev --hostname 127.0.0.1 --port 4323",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DEMO_MODE: "false",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "",
    },
  },
});
