$ErrorActionPreference = "Stop"
$b2bRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$b2bProjectId = 'nodria-b2b-e2e'
$b2bExisting = & docker ps -a --filter "name=^supabase_db_$b2bProjectId$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker is required for the isolated B2B suite.' }
if ($b2bExisting) { throw "The isolated $b2bProjectId database already exists; stop it before starting a new run." }
$b2bWorkdir = Join-Path ([IO.Path]::GetTempPath()) ("nodria-b2b-e2e-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $b2bWorkdir 'supabase') -Force | Out-Null
$b2bConfig = [IO.File]::ReadAllText((Join-Path $b2bRepoRoot 'supabase/config.toml'))
$b2bConfig = $b2bConfig.Replace('project_id = "nodria-commerce"', 'project_id = "nodria-b2b-e2e"').Replace('562', '564')
if ($b2bConfig -notmatch '(?m)^project_id = "nodria-b2b-e2e"\r?$') { throw 'Could not isolate the Supabase project ID.' }
[IO.File]::WriteAllText((Join-Path $b2bWorkdir 'supabase/config.toml'), $b2bConfig)
Copy-Item -LiteralPath (Join-Path $b2bRepoRoot 'supabase/migrations') -Destination (Join-Path $b2bWorkdir 'supabase') -Recurse
Copy-Item -LiteralPath (Join-Path $b2bRepoRoot 'supabase/seed.sql') -Destination (Join-Path $b2bWorkdir 'supabase/seed.sql')
$b2bEnvNames = @('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'B2B_TEST_CONTAINER')
$b2bPreviousEnv = @{}
foreach ($b2bName in $b2bEnvNames) { $b2bPreviousEnv[$b2bName] = [Environment]::GetEnvironmentVariable($b2bName) }
$b2bExitCode = 1
Push-Location $b2bRepoRoot
try {
  # Start only the services needed for GoTrue, PostgREST and browser actions.
  # Capture stdout so local keys are never printed or stored in an artifact.
  & pnpm dlx supabase@latest start --workdir $b2bWorkdir --exclude 'realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Isolated Supabase startup failed.' }
  $b2bStatus = & pnpm dlx supabase@latest status --workdir $b2bWorkdir --output env 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Isolated Supabase status failed.' }
  $b2bValues = @{}
  foreach ($b2bLine in $b2bStatus) {
    if ($b2bLine -match '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY)="(.*)"$') { $b2bValues[$Matches[1]] = $Matches[2] }
  }
  if ($b2bValues['API_URL'] -ne 'http://127.0.0.1:56401') { throw 'Refusing a Supabase URL outside the isolated loopback project.' }
  foreach ($b2bKeyName in @('PUBLISHABLE_KEY', 'SECRET_KEY', 'SERVICE_ROLE_KEY')) {
    if ([string]::IsNullOrWhiteSpace($b2bValues[$b2bKeyName])) { throw "Missing local $b2bKeyName." }
  }
  $env:NEXT_PUBLIC_SUPABASE_URL = $b2bValues['API_URL']
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $b2bValues['PUBLISHABLE_KEY']
  $env:SUPABASE_SECRET_KEY = $b2bValues['SECRET_KEY']
  $env:SUPABASE_SERVICE_ROLE_KEY = $b2bValues['SERVICE_ROLE_KEY']
  $env:B2B_TEST_CONTAINER = "supabase_db_$b2bProjectId"
  & pnpm exec playwright test --config tests/integration/b2b-connected/playwright.config.ts
  $b2bExitCode = $LASTEXITCODE
} finally {
  # Only the instance created by this runner is removed, including its fixtures.
  & pnpm dlx supabase@latest stop --project-id $b2bProjectId --workdir $b2bWorkdir --no-backup | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Warning "Cleanup failed for $b2bProjectId; stop that isolated project manually." }
  foreach ($b2bName in $b2bEnvNames) { [Environment]::SetEnvironmentVariable($b2bName, $b2bPreviousEnv[$b2bName]) }
  Pop-Location
}
exit $b2bExitCode
