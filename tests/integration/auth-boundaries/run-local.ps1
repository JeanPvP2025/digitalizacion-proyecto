#!/usr/bin/env pwsh
[CmdletBinding()]
param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:ProbeCount = 0
$script:FailureCount = 0
$script:UserIds = [System.Collections.Generic.List[string]]::new()
$script:CreatedUsers = [System.Collections.Generic.List[object]]::new()
$script:QuoteFixtureEmails = [System.Collections.Generic.List[string]]::new()
$script:TicketNumber = ""
$script:OrderNumber = ""
$script:DbContainer = "supabase_db_nodria-commerce"

function Write-Probe([string]$Name, [int]$Status, [bool]$Passed, [string]$Boundary) {
  $script:ProbeCount++
  if (-not $Passed) { $script:FailureCount++ }
  $result = if ($Passed) { "PASS" } else { "FAIL" }
  Write-Host ("[{0}] HTTP {1} {2} — {3}" -f $result, $Status, $Name, $Boundary)
}

function Invoke-Http([string]$Method, [string]$Uri, [hashtable]$Headers, [object]$Body = $null) {
  $request = [System.Net.HttpWebRequest]::Create($Uri)
  $request.Method = $Method
  $request.Timeout = 15000
  foreach ($name in $Headers.Keys) {
    if ($name -eq "Content-Type") { $request.ContentType = [string]$Headers[$name] }
    else { $request.Headers[$name] = [string]$Headers[$name] }
  }
  if ($null -ne $Body) {
    $request.ContentType = "application/json"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 12 -Compress))
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Dispose()
  }
  try {
    $response = [System.Net.HttpWebResponse]$request.GetResponse()
  } catch [System.Net.WebException] {
    if ($null -eq $_.Exception.Response) { throw }
    $response = [System.Net.HttpWebResponse]$_.Exception.Response
  }
  $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
  $text = $reader.ReadToEnd()
  $reader.Dispose()
  $status = [int]$response.StatusCode
  $response.Dispose()
  return [pscustomobject]@{ Status = $status; Text = $text }
}

function Invoke-DbSql([string]$Sql) {
  $output = $Sql | & docker exec -i $script:DbContainer psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL fixture SQL failed (exit $LASTEXITCODE): $($output -join [Environment]::NewLine)"
  }
}

function Invoke-DbQuery([string]$Sql) {
  $output = & docker exec $script:DbContainer psql -X -At -U postgres -d postgres -v ON_ERROR_STOP=1 -c $Sql 2>&1
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL query failed: $($output -join [Environment]::NewLine)" }
  return ($output -join "`n").Trim()
}

function Wait-ForLocalSchema([int]$TimeoutSeconds = 90) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
    $health = & docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $script:DbContainer 2>$null
    if ($LASTEXITCODE -eq 0 -and $health -eq "healthy") {
      $ready = & docker exec $script:DbContainer psql -X -At -U postgres -d postgres -c "select (to_regclass('public.organizations') is not null)::text" 2>$null
      if ($LASTEXITCODE -eq 0 -and $ready -eq "true") { return $true }
    }
    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

function Test-Denied($Response) {
  return $Response.Status -eq 401 -or $Response.Status -eq 403
}

function New-AuthFixture([string]$BaseUrl, [string]$PublishableKey, [string]$ServiceRoleKey, [string]$Name, [hashtable]$UserMetadata = @{}) {
  $email = "auth-boundary-$Name-$([guid]::NewGuid().ToString('N'))@nodria.test"
  $password = "$([guid]::NewGuid().ToString('N'))Aa1!"
  $adminHeaders = @{
    apikey = $PublishableKey
    Authorization = "Bearer $ServiceRoleKey"
    "Content-Type" = "application/json"
  }
  $created = Invoke-Http "POST" "$BaseUrl/auth/v1/admin/users" $adminHeaders @{
    email = $email
    password = $password
    email_confirm = $true
    user_metadata = $UserMetadata
  }
  if ($created.Status -lt 200 -or $created.Status -ge 300) {
    throw "Could not create fictional Auth fixture '$Name' (HTTP $($created.Status)): $($created.Text)"
  }
  $user = $created.Text | ConvertFrom-Json
  $script:UserIds.Add([string]$user.id)
  $fixture = [pscustomobject]@{ Name = $Name; Id = [string]$user.id; Email = $email; Password = $password; Token = "" }
  $script:CreatedUsers.Add($fixture)

  # Obtain an access token through GoTrue's password grant, not by forging JWT claims.
  $login = Invoke-Http "POST" "$BaseUrl/auth/v1/token?grant_type=password" @{
    apikey = $PublishableKey
    "Content-Type" = "application/json"
  } @{ email = $email; password = $password }
  if ($login.Status -lt 200 -or $login.Status -ge 300) {
    throw "GoTrue password login failed for '$Name' (HTTP $($login.Status)): $($login.Text)"
  }
  $session = $login.Text | ConvertFrom-Json
  if ([string]$session.user.id -ne $fixture.Id -or [string]::IsNullOrWhiteSpace([string]$session.access_token)) {
    throw "GoTrue returned a session that does not match fixture '$Name'."
  }
  $fixture.Token = [string]$session.access_token
  return $fixture
}

function Invoke-RestProbe($User, [string]$Method, [string]$Path, [object]$Body = $null) {
  $headers = @{ apikey = $script:PublishableKey; Authorization = "Bearer $($User.Token)" }
  return Invoke-Http $Method "$script:ApiUrl/rest/v1/$Path" $headers $Body
}

function Assert-Http([string]$Name, $Response, [scriptblock]$Predicate, [string]$Boundary) {
  $passed = & $Predicate $Response
  Write-Probe $Name $Response.Status ([bool]$passed) $Boundary
  if (-not $passed) {
    $body = [string]$Response.Text
    if ($body.Length -gt 260) { $body = $body.Substring(0, 260) }
    Write-Host "      response: $body"
  }
}

function Test-ClientSecretExposure([string]$SecretKey) {
  $scanRoots = @("app", "components", "public") | ForEach-Object { Join-Path $script:ProjectRoot $_ }
  $files = foreach ($root in $scanRoots) {
    if (Test-Path $root) { Get-ChildItem -LiteralPath $root -File -Recurse }
  }
  $files += Get-ChildItem -LiteralPath (Join-Path $script:ProjectRoot ".next/static") -File -Recurse -ErrorAction SilentlyContinue
  $files += Get-ChildItem -LiteralPath (Join-Path $script:ProjectRoot ".next/dev/static") -File -Recurse -ErrorAction SilentlyContinue
  $leaks = @()
  foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    if (($content -match "NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET_KEY)") -or
        ($SecretKey.Length -gt 20 -and $content.Contains($SecretKey))) {
      $leaks += $file.FullName.Substring($script:ProjectRoot.Length).TrimStart('\', '/')
    }
  }
  $passed = $leaks.Count -eq 0
  Write-Probe "client secret scan" 200 $passed "publicly-prefixed secret identifiers and the local service-role key value are absent from app, components, public and built browser assets"
  if (-not $passed) { Write-Host "      matching files: $($leaks -join ', ')" }
}

function Invoke-QuoteRouteBoundary([string]$SupabaseUrl, [string]$PublishableKey, [bool]$ExpectConnected) {
  $nextCli = Join-Path $script:ProjectRoot "node_modules/next/dist/bin/next"
  if (-not (Test-Path "$nextCli")) { throw "Next.js is not installed. Run 'pnpm install --frozen-lockfile' before the app-route boundary probe." }
  $node = (Get-Command node -ErrorAction Stop).Source
  $port = Get-Random -Minimum 32000 -Maximum 49000
  $runId = [guid]::NewGuid().ToString("N")
  $logPath = Join-Path $env:TEMP "nodria-auth-boundary-$runId.log"
  $errorPath = Join-Path $env:TEMP "nodria-auth-boundary-$runId.err.log"
  $prior = @{}
  foreach ($name in @("DEMO_MODE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")) {
    $prior[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
  }
  $server = $null
  $email = "auth-boundary-app-$runId@nodria.test"
  $script:QuoteFixtureEmails.Add($email)
  try {
    $env:DEMO_MODE = "true"
    $env:NEXT_PUBLIC_SUPABASE_URL = $SupabaseUrl
    $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $PublishableKey
    $env:SUPABASE_SECRET_KEY = ""
    $env:SUPABASE_SERVICE_ROLE_KEY = ""
    $server = Start-Process -FilePath $node -ArgumentList @($nextCli, "dev", "--port", "$port") `
      -WorkingDirectory $script:ProjectRoot -PassThru -WindowStyle Hidden `
      -RedirectStandardOutput $logPath -RedirectStandardError $errorPath

    $ready = $false
    $probe = $null
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
      if ($server.HasExited) { break }
      try {
        $probe = Invoke-Http "GET" "http://127.0.0.1:$port/api/quotes" @{}
        if ($probe.Status -eq 405) { $ready = $true; break }
      } catch { }
      Start-Sleep -Seconds 1
    }
    if (-not $ready) {
      $log = if (Test-Path $errorPath) { Get-Content $errorPath -Raw } else { "no Next.js startup log" }
      if ($log.Length -gt 700) { $log = $log.Substring($log.Length - 700) }
      throw "Next.js quote route did not start on the probe port. $log"
    }

    $payload = @{
      companyName = "NODRIA Auth boundary fixture"
      contactName = "Security Probe"
      email = $email
      phone = ""
      volume = "1–5 equipos"
      message = "Fictional local security probe; no personal or commercial data."
      privacyAccepted = $true
      website = ""
    }
    $response = Invoke-Http "POST" "http://127.0.0.1:$port/api/quotes" @{ "Content-Type" = "application/json" } $payload
    if ($ExpectConnected) {
      $body = if ($response.Text) { $response.Text | ConvertFrom-Json } else { $null }
      $persisted = $false
      if ($null -ne $body) { $persisted = $body.persisted -eq $true -and $body.persistence -eq "supabase" }
      $dbCount = Invoke-DbQuery "select count(*) from public.quote_inquiries where email = '$email'"
      $passed = $response.Status -eq 201 -and $persisted -and $dbCount -eq "1"
      Write-Probe "app quote route with Supabase + DEMO_MODE=true" $response.Status $passed "complete Supabase credentials take precedence over demo mode and persist to Postgres"
    } else {
      $body = if ($response.Text) { $response.Text | ConvertFrom-Json } else { $null }
      $persisted = $false
      if ($null -ne $body) {
        $persisted = ($null -ne $body.PSObject.Properties["persisted"] -and $body.persisted -eq $true) -or
          ($null -ne $body.PSObject.Properties["persistence"] -and $body.persistence -eq "local-demo")
      }
      $dbCount = Invoke-DbQuery "select count(*) from public.quote_inquiries where email = '$email'"
      $passed = $response.Status -eq 500 -and -not $persisted -and $dbCount -eq "0"
      Write-Probe "app quote route with unreachable Supabase + DEMO_MODE=true" $response.Status $passed "connected persistence failure returns an error and does not fall back to local demo files"
    }
  } finally {
    if ($null -ne $server -and -not $server.HasExited) {
      & taskkill.exe /PID $server.Id /T /F 2>$null | Out-Null
    }
    foreach ($name in $prior.Keys) {
      [Environment]::SetEnvironmentVariable($name, $prior[$name], "Process")
    }
    Remove-Item -LiteralPath $logPath, $errorPath -Force -ErrorAction SilentlyContinue
  }
}

function Cleanup-Fixtures([string]$BaseUrl, [string]$PublishableKey, [string]$ServiceRoleKey, [string[]]$OrganizationIds) {
  if (-not [string]::IsNullOrWhiteSpace($script:OrderNumber) -and (Wait-ForLocalSchema 45)) {
    try {
      Invoke-DbSql "BEGIN; DELETE FROM public.audit_events WHERE entity_type = 'orders' AND entity_id = (SELECT id::text FROM public.orders WHERE order_number = '$script:OrderNumber'); ALTER TABLE public.orders DISABLE TRIGGER orders_audit; DELETE FROM public.orders WHERE order_number = '$script:OrderNumber'; ALTER TABLE public.orders ENABLE TRIGGER orders_audit; COMMIT;"
    }
    catch { Write-Host "CLEANUP ERROR: order fixture cleanup failed: $($_.Exception.Message)"; $script:FailureCount++ }
  }
  if (-not [string]::IsNullOrWhiteSpace($script:TicketNumber) -and (Wait-ForLocalSchema 45)) {
    try { Invoke-DbSql "DELETE FROM public.support_tickets WHERE ticket_number = '$script:TicketNumber';" }
    catch { Write-Host "CLEANUP ERROR: support ticket fixture cleanup failed: $($_.Exception.Message)"; $script:FailureCount++ }
  }
  if ($script:QuoteFixtureEmails.Count -gt 0 -and (Wait-ForLocalSchema 45)) {
    $emails = ($script:QuoteFixtureEmails | ForEach-Object { "'$_'" }) -join ","
    try { Invoke-DbSql "DELETE FROM public.quote_inquiries WHERE email IN ($emails);" }
    catch { Write-Host "CLEANUP ERROR: quote fixture cleanup failed: $($_.Exception.Message)"; $script:FailureCount++ }
  }
  if ($OrganizationIds.Count -gt 0 -and (Get-Command docker -ErrorAction SilentlyContinue)) {
    $orgs = ($OrganizationIds | ForEach-Object { "'$_'::uuid" }) -join ","
    try {
      if (Wait-ForLocalSchema 45) {
        Invoke-DbSql "DELETE FROM public.organization_memberships WHERE organization_id IN ($orgs); DELETE FROM public.organizations WHERE id IN ($orgs);"
      } else { throw "local schema did not become ready" }
    }
    catch { Write-Host "CLEANUP ERROR: organization fixture cleanup failed: $($_.Exception.Message)"; $script:FailureCount++ }
  }
  if (-not [string]::IsNullOrWhiteSpace($BaseUrl) -and $script:UserIds.Count -gt 0) {
    $adminHeaders = @{ apikey = $PublishableKey; Authorization = "Bearer $ServiceRoleKey" }
    foreach ($id in $script:UserIds) {
      try {
        $deleted = $null
        for ($attempt = 1; $attempt -le 3; $attempt++) {
          $deleted = Invoke-Http "DELETE" "$BaseUrl/auth/v1/admin/users/$id" $adminHeaders
          if ($deleted.Status -lt 500) { break }
          Start-Sleep -Seconds 2
        }
        if ($deleted.Status -lt 200 -or $deleted.Status -ge 300) {
          Write-Host "CLEANUP ERROR: could not delete fictional Auth user $id (HTTP $($deleted.Status))"
          $script:FailureCount++
        }
      } catch {
        Write-Host "CLEANUP ERROR: could not delete fictional Auth user ${id}: $($_.Exception.Message)"
        $script:FailureCount++
      }
    }
  }
}

$organizationIds = @()
$script:ApiUrl = ""
$script:PublishableKey = ""
$serviceRoleKey = ""

try {
  Push-Location $ProjectRoot
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker CLI is unavailable; local Supabase cannot be probed." }
  $container = & docker inspect --format '{{.State.Status}}' $script:DbContainer 2>$null
  if ($LASTEXITCODE -ne 0 -or $container -ne "running") { throw "Local PostgreSQL container '$script:DbContainer' is not running. Start this project's Supabase stack and retry." }

  # Capture local credentials in memory only. Never print CLI status output or keys.
  $statusOutput = & pnpm dlx supabase@latest status --workdir $ProjectRoot --output json 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Supabase CLI could not read local stack status; run 'pnpm dlx supabase@latest start' first." }
  $status = ($statusOutput -join "`n") | ConvertFrom-Json
  $script:ApiUrl = [string]$status.API_URL
  $script:PublishableKey = [string]$status.PUBLISHABLE_KEY
  if ([string]::IsNullOrWhiteSpace($script:PublishableKey)) { $script:PublishableKey = [string]$status.ANON_KEY }
  $serviceRoleKey = [string]$status.SERVICE_ROLE_KEY
  if ([string]::IsNullOrWhiteSpace($script:ApiUrl) -or [string]::IsNullOrWhiteSpace($script:PublishableKey) -or [string]::IsNullOrWhiteSpace($serviceRoleKey)) {
    throw "Local Supabase status is missing API URL or expected local API keys. No credentials were printed."
  }
  if ([uri]::new($script:ApiUrl).Host -notin @("127.0.0.1", "localhost", "::1")) {
    throw "Refusing to use a non-loopback Supabase API URL; this runner is local-only."
  }
  if (-not (Wait-ForLocalSchema)) { throw "Local database health or project migrations are not ready; retry after the local reset finishes." }

  $authHealth = Invoke-Http "GET" "$script:ApiUrl/auth/v1/health" @{ apikey = $script:PublishableKey }
  Write-Probe "GoTrue health" $authHealth.Status ($authHealth.Status -eq 200) "the local Auth service is reachable"
  $restHealth = Invoke-Http "GET" "$script:ApiUrl/rest/v1/" @{ apikey = $script:PublishableKey }
  Write-Probe "PostgREST root" $restHealth.Status ($restHealth.Status -eq 200) "the local Data API is reachable"
  if ($authHealth.Status -ne 200 -or $restHealth.Status -ne 200) { throw "Local GoTrue/PostgREST health check failed." }

  $roles = [ordered]@{}
  $roles.customerA = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "customer-a" @{ role = "super_admin"; app_role = "super_admin"; roles = @("super_admin") }
  $roles.customerB = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "customer-b"
  $roles.businessAdmin = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "business-admin"
  $roles.businessBuyer = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "business-buyer"
  $roles.catalog = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "catalog-manager"
  $roles.support = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "support-agent"
  $roles.sales = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "sales-manager"
  $roles.warehouse = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "fulfillment-manager"
  $roles.superadmin = New-AuthFixture $script:ApiUrl $script:PublishableKey $serviceRoleKey "super-admin"

  $organizationA = [guid]::NewGuid().ToString()
  $organizationB = [guid]::NewGuid().ToString()
  $organizationIds = @($organizationA, $organizationB)
  $grantPairs = @(
    @($roles.catalog.Id, "catalog_manager"),
    @($roles.support.Id, "support_agent"),
    @($roles.sales.Id, "sales_manager"),
    @($roles.warehouse.Id, "fulfillment_manager"),
    @($roles.superadmin.Id, "super_admin")
  )
  $grantSql = ($grantPairs | ForEach-Object { "('{0}'::uuid, '{1}'::public.app_role)" -f $_[0], $_[1] }) -join ",`n"
  $script:TicketNumber = "AUTH-BOUNDARY-$($organizationA.Replace('-', '').Substring(0, 12))"
  $script:OrderNumber = "AUTH-ORDER-$($organizationA.Replace('-', '').Substring(0, 12))"
  $fixtureSql = @"
BEGIN;
INSERT INTO public.user_role_grants (user_id, role) VALUES $grantSql;
INSERT INTO public.organizations (id, slug, legal_name, display_name, created_by) VALUES
  ('$organizationA'::uuid, 'auth-boundary-a-$($organizationA.Replace('-', '').Substring(0, 12))', 'Fixture Org A SL', 'Fixture Org A', '$($roles.businessAdmin.Id)'::uuid),
  ('$organizationB'::uuid, 'auth-boundary-b-$($organizationB.Replace('-', '').Substring(0, 12))', 'Fixture Org B SL', 'Fixture Org B', '$($roles.businessBuyer.Id)'::uuid);
INSERT INTO public.organization_memberships (organization_id, user_id, role, added_by) VALUES
  ('$organizationA'::uuid, '$($roles.businessAdmin.Id)'::uuid, 'admin', '$($roles.businessAdmin.Id)'::uuid),
  ('$organizationB'::uuid, '$($roles.businessBuyer.Id)'::uuid, 'buyer', '$($roles.businessBuyer.Id)'::uuid);
INSERT INTO public.support_tickets (ticket_number, customer_id, subject)
VALUES ('$script:TicketNumber', '$($roles.customerA.Id)'::uuid, 'Auth boundary support fixture');
INSERT INTO public.orders (
  order_number, customer_id, idempotency_key, checkout_fingerprint, status,
  currency, subtotal, tax_total, shipping_total, discount_total, grand_total,
  shipping_address, billing_address
) VALUES (
  '$script:OrderNumber', '$($roles.customerA.Id)'::uuid, 'auth-boundary-order-$($organizationA.Replace('-', '').Substring(0, 12))', repeat('a', 64),
  'pending_payment', 'EUR', 1, 0, 0, 0, 1, '{}'::jsonb, '{}'::jsonb
);
COMMIT;
"@
  Invoke-DbSql $fixtureSql
  Write-Host "Fixtures: 9 GoTrue users, 5 persisted staff grants, 2 isolated organizations. Passwords/tokens stay in memory."

  foreach ($user in $script:CreatedUsers) {
    $verify = Invoke-Http "GET" "$script:ApiUrl/auth/v1/user" @{ apikey = $script:PublishableKey; Authorization = "Bearer $($user.Token)" }
    $signedIn = $false
    if ($verify.Status -eq 200) { $signedIn = ([string](($verify.Text | ConvertFrom-Json).id) -eq $user.Id) }
    Write-Probe "GoTrue token $($user.Name)" $verify.Status $signedIn "signed access JWT maps to the Auth user before it is sent to PostgREST"
  }

  $anon = @{ Token = "" }
  $anonProducts = Invoke-Http "GET" "$script:ApiUrl/rest/v1/products?select=id&is_published=eq.true&limit=1" @{ apikey = $script:PublishableKey }
  Assert-Http "anon published catalog" $anonProducts { param($r) $r.Status -eq 200 } "unauthenticated requests can read the public catalog"
  $anonProfiles = Invoke-Http "GET" "$script:ApiUrl/rest/v1/profiles?select=id&limit=1" @{ apikey = $script:PublishableKey }
  Assert-Http "anon private profiles" $anonProfiles { param($r) Test-Denied $r } "profiles are not exposed to anon"

  $customerOwn = Invoke-RestProbe $roles.customerA "GET" "profiles?select=id&id=eq.$($roles.customerA.Id)"
  Assert-Http "customer A own profile" $customerOwn { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 1 } "auth.uid() allows the signed-in customer to read its row"
  $customerOther = Invoke-RestProbe $roles.customerA "GET" "profiles?select=id&id=eq.$($roles.customerB.Id)"
  Assert-Http "customer A → customer B IDOR" $customerOther { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 0 } "cross-customer profile lookup returns no rows"
  $customerRoleGrant = Invoke-RestProbe $roles.customerA "GET" "user_role_grants?select=user_id,role&user_id=eq.$($roles.customerA.Id)"
  Assert-Http "forged user_metadata role" $customerRoleGrant { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 0 } "user-editable role/app_role metadata does not create a persisted staff grant"
  $customerOwnTicket = Invoke-RestProbe $roles.customerA "GET" "support_tickets?select=ticket_number&ticket_number=eq.$script:TicketNumber"
  Assert-Http "customer reads own support ticket" $customerOwnTicket { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 1 } "ticket ownership permits the customer to read its support case"
  $otherCustomerTicket = Invoke-RestProbe $roles.customerB "GET" "support_tickets?select=ticket_number&ticket_number=eq.$script:TicketNumber"
  Assert-Http "customer B support ticket IDOR" $otherCustomerTicket { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 0 } "another customer's ticket UUID cannot be enumerated"
  $supportTicket = Invoke-RestProbe $roles.support "GET" "support_tickets?select=ticket_number&ticket_number=eq.$script:TicketNumber"
  Assert-Http "support agent reads authorized queue item" $supportTicket { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 1 } "persisted support role can read its authorized case queue"

  $customerOwnOrder = Invoke-RestProbe $roles.customerA "GET" "orders?select=order_number&order_number=eq.$script:OrderNumber"
  Assert-Http "customer reads own order" $customerOwnOrder { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 1 } "customer can read its own order through a signed GoTrue token"
  $customerOtherOrder = Invoke-RestProbe $roles.customerB "GET" "orders?select=order_number&order_number=eq.$script:OrderNumber"
  Assert-Http "customer B order IDOR" $customerOtherOrder { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 0 } "another customer's order ID is hidden"

  foreach ($entry in @(
    @{ User = $roles.businessAdmin; Own = $organizationA; Other = $organizationB; Label = "business admin" },
    @{ User = $roles.businessBuyer; Own = $organizationB; Other = $organizationA; Label = "business buyer" }
  )) {
    $own = Invoke-RestProbe $entry.User "GET" "organizations?select=id&id=eq.$($entry.Own)"
    Assert-Http "$($entry.Label) own tenant" $own { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 1 } "organization membership permits only its own tenant"
    $other = Invoke-RestProbe $entry.User "GET" "organizations?select=id&id=eq.$($entry.Other)"
    Assert-Http "$($entry.Label) cross-tenant IDOR" $other { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 0 } "another organization UUID returns no rows"
  }

  foreach ($pair in @(
    @($roles.customerA, "customer"), @($roles.catalog, "catalog_manager"), @($roles.support, "support_agent"),
    @($roles.sales, "sales_manager"), @($roles.warehouse, "fulfillment_manager"), @($roles.superadmin, "super_admin")
  )) {
    $user = $pair[0]
    $grant = Invoke-RestProbe $user "GET" "user_role_grants?select=role&user_id=eq.$($user.Id)"
    $rows = @()
    if ($grant.Status -eq 200) { $rows = @($grant.Text | ConvertFrom-Json) }
    $expected = if ($pair[1] -eq "customer") { 0 } else { 1 }
    $roleOk = $grant.Status -eq 200 -and $rows.Count -eq $expected -and ($expected -eq 0 -or [string]$rows[0].role -eq $pair[1])
    Write-Probe "persisted role $($pair[1])" $grant.Status $roleOk "PostgREST sees only the caller's database-backed role grant"
  }

  $warehouseInventory = Invoke-RestProbe $roles.warehouse "GET" "inventory?select=warehouse_id,variant_id&limit=1000"
  Assert-Http "warehouse reads inventory" $warehouseInventory { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -gt 0 } "fulfillment role can inspect stock through its authenticated JWT"
  $warehouseOrders = Invoke-RestProbe $roles.warehouse "GET" "orders?select=id&limit=1000"
  Assert-Http "warehouse reads operations orders" $warehouseOrders { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -gt 0 } "fulfillment role can see the protected operations queue"
  foreach ($pair in @(
    @($roles.customerA, "customer inventory isolation"),
    @($roles.catalog, "catalog manager inventory isolation"),
    @($roles.support, "support inventory isolation"),
    @($roles.sales, "sales inventory isolation")
  )) {
    $response = Invoke-RestProbe $pair[0] "GET" "inventory?select=warehouse_id,variant_id&limit=1000"
    Assert-Http $pair[1] $response { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 0 } "non-fulfillment roles cannot read stock rows"
  }
  foreach ($path in @("orders?select=id&limit=1000", "payment_transactions?select=id&limit=1000")) {
    $response = Invoke-RestProbe $roles.sales "GET" $path
    Assert-Http "sales isolation $($path.Split('?')[0])" $response { param($r) $r.Status -eq 200 -and @($r.Text | ConvertFrom-Json).Count -eq 0 } "sales has no access to customer order or payment records"
  }

  $escalation = Invoke-RestProbe $roles.customerA "POST" "user_role_grants" @{ user_id = $roles.customerA.Id; role = "super_admin" }
  Assert-Http "customer self-assign super_admin" $escalation { param($r) Test-Denied $r } "direct staff grant insertion is rejected"
  $emailMutation = Invoke-RestProbe $roles.customerA "PATCH" "profiles?id=eq.$($roles.customerA.Id)" @{ email = "attacker@nodria.test" }
  Assert-Http "customer profile email escalation" $emailMutation { param($r) Test-Denied $r } "column-level grant denies changing identity email"

  $crossTenantInvite = Invoke-RestProbe $roles.businessAdmin "POST" "rpc/add_organization_member" @{
    p_organization_id = $organizationB
    p_email = $roles.customerA.Email
    p_role = "buyer"
  }
  Assert-Http "business admin cross-tenant member invite" $crossTenantInvite { param($r) $r.Status -eq 403 -or $r.Status -eq 404 } "admin of organization A cannot add a member to organization B"
  $validInvite = Invoke-RestProbe $roles.businessAdmin "POST" "rpc/add_organization_member" @{
    p_organization_id = $organizationA
    p_email = $roles.customerA.Email
    p_role = "viewer"
  }
  Assert-Http "business admin scoped member invite" $validInvite { param($r) $r.Status -eq 200 -and $r.Text -match $roles.customerA.Id } "authorized organization admin can add a limited viewer in its own tenant"

  $rpcCases = @(
    @{ Path = "rpc/resolve_demo_payment"; Body = @{ p_order_id = [guid]::Empty.ToString(); p_outcome = "approved"; p_event_id = "fixture-denied" }; Name = "payment outcome" },
    @{ Path = "rpc/fulfill_order"; Body = @{ p_order_id = [guid]::Empty.ToString() }; Name = "fulfillment" },
    @{ Path = "rpc/mark_order_delivered"; Body = @{ p_order_id = [guid]::Empty.ToString() }; Name = "delivery transition" },
    @{ Path = "rpc/adjust_inventory"; Body = @{ p_warehouse_id = [guid]::Empty.ToString(); p_variant_id = [guid]::Empty.ToString(); p_delta = 1; p_reason = "fixture" }; Name = "inventory adjustment" }
  )
  foreach ($case in $rpcCases) {
    foreach ($user in @($roles.customerA, $roles.businessAdmin, $roles.businessBuyer, $roles.catalog, $roles.support, $roles.sales, $roles.warehouse, $roles.superadmin)) {
      $response = Invoke-RestProbe $user "POST" $case.Path $case.Body
      Assert-Http "$($user.Name) service-only $($case.Name) RPC" $response { param($r) Test-Denied $r } "RPC grant is withheld from authenticated JWTs; the server-only service role is required"
    }
  }

  Invoke-QuoteRouteBoundary $script:ApiUrl $script:PublishableKey $true
  Invoke-QuoteRouteBoundary "http://127.0.0.1:1" $script:PublishableKey $false
  Test-ClientSecretExposure $serviceRoleKey
} catch {
  Write-Host "RUNNER ERROR: $($_.Exception.Message)"
  $script:FailureCount++
} finally {
  Cleanup-Fixtures $script:ApiUrl $script:PublishableKey $serviceRoleKey $organizationIds
  if (Get-Location) { Pop-Location -ErrorAction SilentlyContinue }
  Write-Host ("Auth boundary probes: {0}; failures: {1}." -f $script:ProbeCount, $script:FailureCount)
}

if ($script:FailureCount -gt 0) { exit 1 }
