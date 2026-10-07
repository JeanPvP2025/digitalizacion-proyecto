$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$projectId = "nodria-ux-audit"
$workdir = Join-Path ([IO.Path]::GetTempPath()) ("nodria-ux-audit-" + [guid]::NewGuid().ToString("N"))
$existing = & docker ps -a --filter "name=^supabase_db_$projectId$" --format "{{.Names}}"
if ($LASTEXITCODE -ne 0) { throw "Docker is required for the isolated UX role suite." }
if ($existing) { throw "The isolated $projectId database already exists; inspect it before retrying." }
$portListeners = Get-NetTCPConnection -LocalPort 56801 -State Listen -ErrorAction SilentlyContinue
if ($portListeners) { throw "Loopback port 56801 is in use; refusing to collide with another local project." }

New-Item -ItemType Directory -Path (Join-Path $workdir "supabase") -Force | Out-Null
$config = [IO.File]::ReadAllText((Join-Path $repoRoot "supabase/config.toml"))
$config = $config.Replace('project_id = "nodria-commerce"', 'project_id = "nodria-ux-audit"').Replace("562", "568")
if ($config -notmatch '(?m)^project_id = "nodria-ux-audit"\r?$') { throw "Could not isolate the Supabase project ID." }
[IO.File]::WriteAllText((Join-Path $workdir "supabase/config.toml"), $config)
Copy-Item -LiteralPath (Join-Path $repoRoot "supabase/migrations") -Destination (Join-Path $workdir "supabase") -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot "supabase/seed.sql") -Destination (Join-Path $workdir "supabase/seed.sql")

$envNames = @("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "UX_ROLE_ACCOUNTS")
$previousEnv = @{}
foreach ($name in $envNames) { $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name) }
$exitCode = 1
Push-Location $repoRoot
try {
  & pnpm dlx supabase@latest start --workdir $workdir --exclude "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Isolated Supabase startup failed." }
  $status = & pnpm dlx supabase@latest status --workdir $workdir --output env 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Isolated Supabase status failed." }
  $values = @{}
  foreach ($line in $status) {
    if ($line -match '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY)="(.*)"$') { $values[$Matches[1]] = $Matches[2] }
  }
  if ($values["API_URL"] -ne "http://127.0.0.1:56801") { throw "Refusing a Supabase URL outside the isolated loopback project." }
  foreach ($keyName in @("PUBLISHABLE_KEY", "SECRET_KEY", "SERVICE_ROLE_KEY")) {
    if ([string]::IsNullOrWhiteSpace($values[$keyName])) { throw "Missing local $keyName." }
  }

  $env:NEXT_PUBLIC_SUPABASE_URL = $values["API_URL"]
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $values["PUBLISHABLE_KEY"]
  $env:SUPABASE_SECRET_KEY = $values["SECRET_KEY"]
  $env:SUPABASE_SERVICE_ROLE_KEY = $values["SERVICE_ROLE_KEY"]
  $headers = @{ apikey = $values["SERVICE_ROLE_KEY"]; Authorization = "Bearer $($values['SERVICE_ROLE_KEY'])" }
  $fixtureTag = [guid]::NewGuid().ToString("N")
  $roles = @("super_admin", "catalog_manager", "support_agent", "sales_manager", "fulfillment_manager")
  $accounts = [System.Collections.Generic.List[object]]::new()
  foreach ($role in $roles) {
    $email = "qa-$role-$fixtureTag@nodria.test"
    $password = ([guid]::NewGuid().ToString("N") + "Aa1!")
    $body = @{ email = $email; password = $password; email_confirm = $true; user_metadata = @{ full_name = "QA $role" } } | ConvertTo-Json -Depth 5
    $user = Invoke-RestMethod -Method Post -Uri "$($values['API_URL'])/auth/v1/admin/users" -Headers $headers -ContentType "application/json" -Body $body
    $accounts.Add([pscustomobject]@{ role = $role; email = $email; password = $password; id = [string]$user.id })
  }

  $superAdminId = ($accounts | Where-Object role -eq "super_admin").id
  $grants = @($accounts | ForEach-Object { @{ user_id = $_.id; role = $_.role; granted_by = $superAdminId } }) | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Post -Uri "$($values['API_URL'])/rest/v1/user_role_grants" -Headers ($headers + @{ Prefer = "resolution=merge-duplicates,return=minimal" }) -ContentType "application/json" -Body $grants | Out-Null

  $env:UX_ROLE_ACCOUNTS = ConvertTo-Json @($accounts | ForEach-Object { @{ role = $_.role; email = $_.email; password = $_.password } }) -Compress
  & pnpm exec playwright test --config tests/e2e/ux-audit/roles.config.ts
  $exitCode = $LASTEXITCODE
} finally {
  & pnpm dlx supabase@latest stop --project-id $projectId --workdir $workdir --no-backup | Out-Null
  $stopExitCode = $LASTEXITCODE
  if ($stopExitCode -ne 0) {
    Write-Warning "Cleanup failed for $projectId; keep its config at $workdir and stop only that isolated project manually."
  } else {
    Write-Host "Stopped isolated Supabase project $projectId. No local keys are written to $workdir."
  }
  foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $previousEnv[$name]) }
  Pop-Location
}
exit $exitCode
