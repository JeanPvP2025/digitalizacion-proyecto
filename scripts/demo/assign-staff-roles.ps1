$ErrorActionPreference = "Stop"

function Get-DotEnvValue([string]$Name) {
  $envFile = Join-Path (Get-Location) ".env.local"
  if (-not (Test-Path -LiteralPath $envFile)) { throw "Create .env.local for Supabase local first." }
  $content = Get-Content -LiteralPath $envFile -Raw
  $match = [regex]::Match($content, "(?m)^\s*$([regex]::Escape($Name))\s*=\s*([^\r\n#]*)")
  if (-not $match.Success) { throw "Missing $Name in .env.local." }
  return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

$configuredUrl = Get-DotEnvValue "NEXT_PUBLIC_SUPABASE_URL"
if ($configuredUrl -notmatch '^https?://(127\.0\.0\.1|localhost)(:\d+)?/?$') {
  throw "This helper only supports a local loopback Supabase URL. No remote URL was contacted."
}

$statusLines = & pnpm dlx supabase@latest status -o env
if ($LASTEXITCODE -ne 0) { throw "Supabase local is not running. Start it with pnpm dlx supabase@latest start." }
$status = @{}
foreach ($line in $statusLines) {
  if ($line -match '^([A-Z_]+)="(.*)"$') { $status[$Matches[1]] = $Matches[2] }
}
$apiUrl = [string]$status["API_URL"]
$serviceRoleKey = [string]$status["SERVICE_ROLE_KEY"]
if (-not $apiUrl -or $configuredUrl.TrimEnd('/') -ne $apiUrl.TrimEnd('/')) {
  throw "The app URL and active local Supabase URL do not match. Check .env.local and the CLI status."
}
if (-not $serviceRoleKey) { throw "The local CLI did not provide its server-only service role key." }

$container = "supabase_db_nodria-commerce"
$runningContainer = & docker ps --filter "name=^/$container$" --format "{{.Names}}"
if ($LASTEXITCODE -ne 0 -or $runningContainer -ne $container) {
  throw "Expected local database container '$container' is not running. No grants were written."
}

$roles = @(
  @{ Role = "super_admin"; Label = "Superadministración" },
  @{ Role = "catalog_manager"; Label = "Catálogo" },
  @{ Role = "support_agent"; Label = "Soporte" },
  @{ Role = "sales_manager"; Label = "Ventas" },
  @{ Role = "fulfillment_manager"; Label = "Almacén" }
)
$userResponse = Invoke-RestMethod -Method Get `
  -Uri "$apiUrl/auth/v1/admin/users?page=1&per_page=1000" `
  -Headers @{ apikey = $serviceRoleKey; Authorization = "Bearer $serviceRoleKey" }
$users = @($userResponse.users)
if ($users.Count -eq 0) { throw "No Auth accounts exist yet. Create fictitious .test accounts at /acceso first." }

$selected = [System.Collections.Generic.List[object]]::new()
$usedEmails = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($entry in $roles) {
  $email = (Read-Host "Email de la cuenta local ya creada para $($entry.Label) ($($entry.Role))").Trim()
  if ($email -notmatch '^[^\s@]+@[^\s@]+\.test$') { throw "Use a fictitious address ending in .test." }
  if (-not $usedEmails.Add($email)) { throw "Each staff role must use a different Auth account." }
  $user = $users | Where-Object { $_.email -ieq $email } | Select-Object -First 1
  if (-not $user) { throw "No local Auth account exists for $email. Create it from /acceso and retry." }
  if ([string]$user.id -notmatch '^[0-9a-fA-F-]{36}$') { throw "Auth returned an invalid user id for $email." }
  $selected.Add([pscustomobject]@{ Id = [string]$user.id; Email = $email; Role = $entry.Role; Label = $entry.Label })
}

$superAdminId = ($selected | Where-Object Role -eq "super_admin").Id
$rows = foreach ($entry in $selected) {
  "  ('$($entry.Id)'::uuid, '$($entry.Role)'::public.app_role, '$superAdminId'::uuid)"
}
$sql = @"
begin;
insert into public.user_role_grants (user_id, role, granted_by)
values
$($rows -join ",`n")
on conflict (user_id, role) do update
  set granted_by = excluded.granted_by, granted_at = now();
commit;
"@
$sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw "Role assignment failed; inspect the local database before retrying." }

Write-Host "Local role accounts are ready. Restart pnpm dev and sign in with the fictional .test accounts you created."
foreach ($entry in $selected) { Write-Host "  $($entry.Label): $($entry.Email)" }
Write-Host "These grants exist only in this local Supabase database. Reset it with db reset to remove them."
