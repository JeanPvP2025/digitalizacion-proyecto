param([string]$TestFilter)

$ErrorActionPreference = "Stop"

# Read local Supabase values into process memory. Never print or persist secrets.
$statusOutput = & pnpm dlx supabase@latest status --output env 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Supabase local status failed. Start and migrate the local project first."
}

$values = @{}
foreach ($line in $statusOutput) {
  if ($line -match '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY)="(.*)"$') {
    $values[$Matches[1]] = $Matches[2]
  }
}

$apiUri = [Uri]$values["API_URL"]
if ($apiUri.Host -notin @("127.0.0.1", "localhost", "::1") -or $apiUri.Port -ne 56201) {
  throw "Connected domain E2E only permits the configured local Supabase API at loopback port 56201."
}
foreach ($name in @("PUBLISHABLE_KEY", "SECRET_KEY", "SERVICE_ROLE_KEY")) {
  if (-not $values.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($values[$name])) {
    throw "Supabase local status did not return the required $name value."
  }
}

$env:NEXT_PUBLIC_SUPABASE_URL = $values["API_URL"]
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $values["PUBLISHABLE_KEY"]
$env:SUPABASE_SECRET_KEY = $values["SECRET_KEY"]
$env:SUPABASE_SERVICE_ROLE_KEY = $values["SERVICE_ROLE_KEY"]
$env:DEMO_MODE = "false"

$playwrightArgs = @("exec", "playwright", "test", "--config", "tests/e2e/connected-domains/playwright.config.ts")
if (-not [string]::IsNullOrWhiteSpace($TestFilter)) {
  $playwrightArgs += @("--grep", $TestFilter)
}
& pnpm @playwrightArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
