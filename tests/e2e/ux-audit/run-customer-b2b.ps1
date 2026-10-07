$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$projectId = "nodria-customer-b2b"
$workdir = Join-Path ([IO.Path]::GetTempPath()) ("nodria-customer-b2b-" + [guid]::NewGuid().ToString("N"))
$ports = @(4331, 56900, 56901, 56902, 56903, 56904, 56905, 56906, 56907)
$existing = & docker ps -a --filter "name=$projectId" --format "{{.Names}}"
if ($LASTEXITCODE -ne 0) { throw "Docker is required for the isolated customer/B2B suite." }
if (@($existing | Where-Object { $_ -match [regex]::Escape($projectId) }).Count -gt 0) {
  throw "Found containers for $projectId; inspect that isolated project before retrying."
}
foreach ($port in $ports) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw "Loopback port $port is in use; refusing to collide with another local project."
  }
}

$envNames = @("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")
$previousEnv = @{}
foreach ($name in $envNames) { $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name) }
$started = $false
$exitCode = 1
$stopFailure = $false

try {
  New-Item -ItemType Directory -Path (Join-Path $workdir "supabase") -Force | Out-Null
  $config = [IO.File]::ReadAllText((Join-Path $repoRoot "supabase/config.toml"))
  $config = $config.Replace('project_id = "nodria-commerce"', 'project_id = "nodria-customer-b2b"').Replace("562", "569")
  if ($config -notmatch '(?m)^project_id = "nodria-customer-b2b"\r?$') { throw "Could not isolate the Supabase project ID." }
  [IO.File]::WriteAllText((Join-Path $workdir "supabase/config.toml"), $config)
  Copy-Item -LiteralPath (Join-Path $repoRoot "supabase/migrations") -Destination (Join-Path $workdir "supabase") -Recurse
  Copy-Item -LiteralPath (Join-Path $repoRoot "supabase/seed.sql") -Destination (Join-Path $workdir "supabase/seed.sql")

  Push-Location $repoRoot
  try {
    $started = $true
    & pnpm dlx supabase@latest start --workdir $workdir --exclude "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Isolated Supabase startup failed." }
    $status = & pnpm dlx supabase@latest status --workdir $workdir --output env 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Isolated Supabase status failed." }
    $values = @{}
    foreach ($line in $status) {
      if ($line -match '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY)="(.*)"$') { $values[$Matches[1]] = $Matches[2] }
    }
    if ($values["API_URL"] -ne "http://127.0.0.1:56901") { throw "Refusing a Supabase URL outside the isolated loopback project." }
    foreach ($keyName in @("PUBLISHABLE_KEY", "SECRET_KEY", "SERVICE_ROLE_KEY")) {
      if ([string]::IsNullOrWhiteSpace($values[$keyName])) { throw "Missing local $keyName." }
    }

    $env:NEXT_PUBLIC_SUPABASE_URL = $values["API_URL"]
    $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $values["PUBLISHABLE_KEY"]
    $env:SUPABASE_SECRET_KEY = $values["SECRET_KEY"]
    $env:SUPABASE_SERVICE_ROLE_KEY = $values["SERVICE_ROLE_KEY"]
    & pnpm exec playwright test --config tests/e2e/ux-audit/customer-b2b.config.ts
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  if ($started) {
    & pnpm dlx supabase@latest stop --project-id $projectId --workdir $workdir --no-backup | Out-Null
    if ($LASTEXITCODE -ne 0) {
      $stopFailure = $true
      Write-Warning "Cleanup failed for $projectId; stop only this isolated project manually using its workdir $workdir."
    } else {
      Write-Host "Stopped isolated Supabase project $projectId. Local keys were kept in process memory only."
    }
  }
  foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $previousEnv[$name]) }
  if (-not $stopFailure -and (Test-Path -LiteralPath $workdir)) {
    Remove-Item -LiteralPath $workdir -Recurse -Force
  }
}
if ($stopFailure -and $exitCode -eq 0) { $exitCode = 1 }
exit $exitCode
