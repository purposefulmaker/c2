param(
    [switch]$SetupAzure,
    [string]$ClientId,
    [string]$ClientSecret,
    [string]$TenantId,
    [string]$RedirectUri = "http://localhost:8085/auth/azure/callback",
    [string[]]$Scopes = @("openid","profile","email"),
    [string]$AdminEmails,
    [string]$RoleMappingsPath,
    [string]$SetupToken
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg)  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-OK($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Test-Command($name) {
    try { Get-Command $name -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

function Wait-ForHttp($url, [int]$timeoutSec = 60) {
    $end = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $end) {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { return $true }
        } catch { Start-Sleep -Seconds 2 }
    }
    return $false
}

function Get-EnvValueFromFile([string]$filePath, [string]$key) {
    if (-not (Test-Path $filePath)) { return $null }
    $line = Select-String -Path $filePath -Pattern "^\s*$($key)\s*=\s*(.+)$" | Select-Object -First 1
    if ($null -eq $line) { return $null }
    $val = $line.Matches[0].Groups[1].Value.Trim()
    return $val
}

# Resolve repo root (this script is expected at c2/scripts)
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$ComposeFile = Join-Path $RepoRoot 'docker-compose.yml'
if (-not (Test-Path $ComposeFile)) {
    Write-Err "docker-compose.yml not found at $ComposeFile"
    exit 1
}

Write-Info "Bringing up containers with Docker Compose"
$composeCmd = $null
if (Test-Command 'docker') {
    # Prefer new plugin syntax
    $composeCmd = { docker compose -f $ComposeFile up -d --build }
} elseif (Test-Command 'docker-compose') {
    $composeCmd = { docker-compose -f $ComposeFile up -d --build }
} else {
    Write-Err "Docker not found. Install Docker Desktop."
    exit 1
}

& $composeCmd
Write-OK "Compose started"

Write-Info "Waiting for services to respond"
$authReady = Wait-ForHttp "http://localhost:8085/setup/status" 120
$apiReady  = Wait-ForHttp "http://localhost:8000/health" 120
$feReady   = Wait-ForHttp "http://localhost:3000" 120

if ($authReady) { Write-OK "auth-service ready" } else { Write-Warn "auth-service not responding yet" }
if ($apiReady)  { Write-OK "backend ready" } else { Write-Warn "backend not responding yet" }
if ($feReady)   { Write-OK "frontend ready" } else { Write-Warn "frontend not responding yet" }

if (-not $SetupAzure) {
    Write-Info "Skip Azure setup (use -SetupAzure to run)."
    Write-Host "Next: Open http://localhost:3000 and http://localhost:8085/auth/azure" -ForegroundColor Magenta
    exit 0
}

Write-Info "Running one-time Azure SSO setup"
$AuthEnvPath = Join-Path $RepoRoot 'services/auth-service/.env'
if (-not $SetupToken) {
    $SetupToken = Get-EnvValueFromFile $AuthEnvPath 'SETUP_TOKEN'
}
if (-not $SetupToken) {
    Write-Err "SETUP_TOKEN is required (pass -SetupToken or set in services/auth-service/.env)"
    exit 1
}

# Collect roleMappings
$roleMappings = $null
if ($RoleMappingsPath) {
    if (-not (Test-Path $RoleMappingsPath)) {
        Write-Err "Role mappings file not found: $RoleMappingsPath"
        exit 1
    }
    try { $roleMappings = Get-Content $RoleMappingsPath -Raw | ConvertFrom-Json } catch { Write-Err "Invalid role mappings JSON"; exit 1 }
}

# Validate mandatory fields
if (-not $ClientId -or -not $TenantId) {
    Write-Err "ClientId and TenantId are required for setup"
    exit 1
}

$body = [ordered]@{
    clientId     = $ClientId
    clientSecret = $ClientSecret
    tenantId     = $TenantId
    redirectUri  = $RedirectUri
    scopes       = $Scopes
}
if ($AdminEmails)   { $body.adminEmails  = $AdminEmails }
if ($roleMappings)  { $body.roleMappings = $roleMappings }

try {
    $json = $body | ConvertTo-Json -Depth 6
    $resp = Invoke-RestMethod -Method Post -Uri "http://localhost:8085/setup/azure" -Headers @{ 'x-setup-token' = $SetupToken } -ContentType 'application/json' -Body $json
    Write-OK "Setup complete"
    $status = Invoke-RestMethod -Method Get -Uri "http://localhost:8085/setup/status"
    Write-Host ("Setup status: " + ($status | ConvertTo-Json -Depth 5))
} catch {
    Write-Err ("Setup failed: " + $_.Exception.Message)
    exit 1
}

Write-Host "Login: http://localhost:8085/auth/azure" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
