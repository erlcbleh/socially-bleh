# Opens a local SSH tunnel to Postgres on the VPS.
# Keep this window open while developing / migrating.
# Usage: .\scripts\ssh-tunnel-postgres.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

$hostName = "187.77.213.209"
$user = "cayday"
$localPort = 5433
$remotePort = 5432

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*SSH_TUNNEL_HOST=(.+)$') { $hostName = $matches[1].Trim() }
    if ($_ -match '^\s*SSH_TUNNEL_USER=(.+)$') { $user = $matches[1].Trim() }
    if ($_ -match '^\s*SSH_TUNNEL_LOCAL_PORT=(.+)$') { $localPort = [int]$matches[1].Trim() }
    if ($_ -match '^\s*SSH_TUNNEL_REMOTE_PORT=(.+)$') { $remotePort = [int]$matches[1].Trim() }
  }
}

Write-Host "Tunnel: 127.0.0.1:$localPort -> ${user}@${hostName}:$remotePort"
Write-Host "Keep this window open. Ctrl+C to close."
Write-Host ""

ssh -N -L "${localPort}:127.0.0.1:${remotePort}" "${user}@${hostName}"
