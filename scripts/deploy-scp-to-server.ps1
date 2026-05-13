#Requires -Version 5.1
<#
.SYNOPSIS
  Windows -> Linux: build a .tgz (excludes node_modules, .git, dist), copy with scp, extract on server.
  Same env as deploy.env.example / deploy.local.env (DEPLOY_SSH_* , DEPLOY_REMOTE_PATH).
#>
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$envFile = Join-Path $PSScriptRoot "deploy.local.env"
$fallback = Join-Path $PSScriptRoot "deploy.env.example"
if (-not (Test-Path $envFile) -and (Test-Path $fallback)) { $envFile = $fallback }
if (-not (Test-Path $envFile)) { Write-Error "Missing deploy.env.example or deploy.local.env" }

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

if (-not $env:DEPLOY_SSH_USER) { Write-Error "Set DEPLOY_SSH_USER" }
if (-not $env:DEPLOY_SSH_HOST) { Write-Error "Set DEPLOY_SSH_HOST" }
if (-not $env:DEPLOY_REMOTE_PATH) { Write-Error "Set DEPLOY_REMOTE_PATH" }
$DeployPort = if ($env:DEPLOY_SSH_PORT) { $env:DEPLOY_SSH_PORT } else { "22" }

$archiveName = "chat-box-sync.tgz"
$localArchive = Join-Path $env:TEMP $archiveName

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
$tarArgs = $excludes + @("-czf", $localArchive, ".")

Write-Host "==> tar -> $localArchive"
if (Test-Path $localArchive) { Remove-Item -Force $localArchive }
try {
	& tar @tarArgs

	$remoteUserHost = "$($env:DEPLOY_SSH_USER)@$($env:DEPLOY_SSH_HOST)"
	$remoteDest = "${remoteUserHost}:$($env:DEPLOY_REMOTE_PATH)/$archiveName"

	Write-Host "==> scp -P $DeployPort -> $remoteDest"
	# scp روی OpenSSH ویندوز برای پورت از -P بزرگ استفاده می‌کند
	& scp -P $DeployPort $localArchive $remoteDest

	Write-Host "==> ssh: extract + remove remote archive"
	$rp = $env:DEPLOY_REMOTE_PATH
	$an = $archiveName
	$remoteShell = "bash -lc 'set -e; cd `"$rp`" && tar xzf $an && rm -f $an'"
	& ssh -p $DeployPort -o StrictHostKeyChecking=accept-new $remoteUserHost $remoteShell
}
finally {
	if (Test-Path $localArchive) { Remove-Item -Force $localArchive }
}
Write-Host "Done."
