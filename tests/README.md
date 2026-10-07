# Quality checks

Install the Chromium browser once before running E2E checks:

```powershell
pnpm exec playwright install chromium
```

Run the checks with:

```powershell
pnpm test
pnpm test:e2e
```

Vitest tests the PC compatibility rules and invokes the real checkout route with
the local demo filesystem redirected to a temporary directory. Playwright
starts Next.js on `127.0.0.1:4317` with demo mode enabled and blank Supabase
credentials; external HTTPS browser requests are blocked. Its reports go under
`.data/playwright-results/`, which is ignored by Git.
