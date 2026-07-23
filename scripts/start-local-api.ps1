$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop is required for this local deployment.' }
& (Join-Path $PSScriptRoot 'prepare-local-api.ps1')

docker compose up -d postgres redis
npm run db:generate -w @wisadel/api
Push-Location apps/api
& .\node_modules\.bin\prisma.cmd migrate deploy --schema prisma/schema.prisma
Pop-Location
npm run build -w @wisadel/contracts
npm run build -w @wisadel/api

$running = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match 'apps[\\/]api[\\/]dist[\\/]main\.js|@wisadel/api' }
if (-not $running) {
  $logDirectory = Join-Path $root 'logs'
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  Start-Process -FilePath 'node.exe' -ArgumentList 'dist/main.js' -WorkingDirectory (Join-Path $root 'apps/api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'api.log') -RedirectStandardError (Join-Path $logDirectory 'api-error.log')
}

Start-Sleep -Seconds 3
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/health' | ConvertTo-Json -Depth 5
