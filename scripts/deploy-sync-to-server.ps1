#Requires -Version 5.1
<#
.SYNOPSIS
  Sync repo from Windows (PowerShell) to Ubuntu over SSH using tar + ssh (no WSL).
  Uses scripts/deploy.local.env if present; otherwise scripts/deploy.env.example (team defaults).
#>
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$envFile = Join-Path $PSScriptRoot "deploy.local.env"
$fallback = Join-Path $PSScriptRoot "deploy.env.example"
if (-not (Test-Path $envFile) -and (Test-Path $fallback)) {
	$envFile = $fallback
}
if (-not (Test-Path $envFile)) {
	Write-Error "Missing deploy config: create scripts/deploy.local.env (see scripts/deploy.env.example)."
}

Get-Content $envFile | ForEach-Object {
	$t = $_.Trim()
	if ($t.StartsWith("#") -or $t -eq "") { return }
	$t = $t -replace "^export\s+", ""
	$i = $t.IndexOf("=")
	if ($i -lt 1) { return }
	$key = $t.Substring(0, $i).Trim()
	$val = $t.Substring($i + 1).Trim().Trim('"')
	Set-Item -Path "Env:$key" -Value $val
}

if (-not $env:DEPLOY_SSH_USER) { Write-Error "Set DEPLOY_SSH_USER in deploy.env.example or deploy.local.env" }
if (-not $env:DEPLOY_SSH_HOST) { Write-Error "Set DEPLOY_SSH_HOST in deploy.env.example or deploy.local.env" }
if (-not $env:DEPLOY_REMOTE_PATH) { Write-Error "Set DEPLOY_REMOTE_PATH in deploy.env.example or deploy.local.env" }

$DeployPort = if ($env:DEPLOY_SSH_PORT) { $env:DEPLOY_SSH_PORT } else { "22" }
$DeployUser = $env:DEPLOY_SSH_USER
$DeployHost = $env:DEPLOY_SSH_HOST
$RemotePath = $env:DEPLOY_REMOTE_PATH
$sshTarget = "${DeployUser}@${DeployHost}"

$sshBase = @("-p", $DeployPort, "-o", "StrictHostKeyChecking=accept-new", $sshTarget)

Write-Host "==> Ensure remote directory exists"
& ssh @sshBase "mkdir -p `"$RemotePath`""

$excludes = @(
	"--exclude=node_modules",
	"--exclude=.git",
	"--exclude=.turbo",
	"--exclude=dist",
	"--exclude=**/dist",
	"--exclude=.env",
	"--exclude=.pnpm-store",
	"--exclude=coverage"
)
$tarArgs = $excludes + @("-czf", "-", ".")

Write-Host "==> tar | ssh -> $RemotePath"
$remoteTar = "mkdir -p `"$RemotePath`" && tar xzf - -C `"$RemotePath`""
& tar @tarArgs | & ssh @sshBase $remoteTar

if ($env:RUN_REMOTE_AFTER_SYNC -eq "1") {
	Write-Host "==> Remote: pnpm install + docker compose up -d"
	$remoteCmd = "bash -lc 'set -e; cd `"$RemotePath`"; command -v pnpm >/dev/null || { echo pnpm not found on server; exit 1; }; pnpm install --frozen-lockfile; docker compose up -d'"
	& ssh @sshBase $remoteCmd
}

Write-Host "Done."
