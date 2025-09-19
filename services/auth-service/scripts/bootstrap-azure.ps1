param(
    [Parameter(Mandatory=$false)][string]$ClientId,
    [Parameter(Mandatory=$false)][string]$ClientSecret,
    [Parameter(Mandatory=$false)][string]$TenantId,
    [Parameter(Mandatory=$false)][string]$RedirectUri = "http://localhost:8085/auth/azure/callback",
    [string[]]$Scopes = @("openid","profile","email"),
    [string]$AdminEmails,
    [string]$RoleMappingsPath,
    [string]$SetupToken
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg)  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-OK($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Err($msg)   { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Try to read SETUP_TOKEN from .env if not provided
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path (Split-Path -Parent $ScriptRoot) '.env'
if (-not $SetupToken -and (Test-Path $EnvPath)) {
    $line = Select-String -Path $EnvPath -Pattern '^\s*SETUP_TOKEN\s*=\s*(.+)$' | Select-Object -First 1
    if ($line) { $SetupToken = $line.Matches[0].Groups[1].Value.Trim() }
}
if (-not $SetupToken) { Write-Err "Provide -SetupToken or set SETUP_TOKEN in .env"; exit 1 }

# Validate required fields
if (-not $ClientId -or -not $TenantId) {
    Write-Err "ClientId and TenantId are required"
    exit 1
}

$roleMappings = $null
if ($RoleMappingsPath) {
    if (-not (Test-Path $RoleMappingsPath)) { Write-Err "Role mappings file not found"; exit 1 }
    try { $roleMappings = Get-Content $RoleMappingsPath -Raw | ConvertFrom-Json } catch { Write-Err "Invalid roleMappings JSON"; exit 1 }
}

$body = [ordered]@{
    clientId     = $ClientId
    clientSecret = $ClientSecret
    tenantId     = $TenantId
    redirectUri  = $RedirectUri
    scopes       = $Scopes
}
if ($AdminEmails)  { $body.adminEmails  = $AdminEmails }
if ($roleMappings) { $body.roleMappings = $roleMappings }

$json = $body | ConvertTo-Json -Depth 6

try {
    $resp = Invoke-RestMethod -Method Post -Uri "http://localhost:8085/setup/azure" -Headers @{ 'x-setup-token' = $SetupToken } -ContentType 'application/json' -Body $json
    Write-OK "Setup complete"
} catch {
    Write-Err ("Setup failed: " + $_.Exception.Message)
    exit 1
}
