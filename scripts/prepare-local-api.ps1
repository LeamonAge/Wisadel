param(
  [string]$EnvironmentFile = (Join-Path $PSScriptRoot '..\.env')
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = [IO.Path]::GetFullPath($EnvironmentFile)

if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $root '.env.example') $envFile
}

# Preserve API keys already in .env, but point all infrastructure at this PC.
$values = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { $values[$matches[1]] = $matches[2] }
}
$localValues = @{
  NODE_ENV = 'production'
  PORT = '3000'
  APP_ORIGIN = 'null'
  ADMIN_ORIGIN = 'http://localhost:5174'
  DATA_MODE = 'postgres'
  AI_MODE = 'integrated'
  QUEUE_MODE = 'redis'
  DATABASE_URL = 'postgresql://wisadel:change-me@127.0.0.1:5432/wisadel?schema=public'
  REDIS_URL = 'redis://127.0.0.1:6379'
  SD_BASE_URL = 'http://127.0.0.1:7860'
  SD_MODE = 'remote'
  IMAGE_STORAGE = 'local'
  UPLOAD_DIR = './apps/api/uploads'
  PUBLIC_BASE_URL = 'http://127.0.0.1:3000'
  AGENT_WORKSPACE_ROOT = $root
  AGENT_FULL_ACCESS = 'false'
}
foreach ($entry in $localValues.GetEnumerator()) { $values[$entry.Key] = $entry.Value }

if (-not $values['JWT_ACCESS_SECRET'] -or $values['JWT_ACCESS_SECRET'] -like 'replace-*') {
  $values['JWT_ACCESS_SECRET'] = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
}
if (-not $values['JWT_REFRESH_SECRET'] -or $values['JWT_REFRESH_SECRET'] -like 'replace-*') {
  $values['JWT_REFRESH_SECRET'] = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
}

$order = @('NODE_ENV','PORT','APP_ORIGIN','ADMIN_ORIGIN','DATA_MODE','AI_MODE','QUEUE_MODE','DATABASE_URL','REDIS_URL','JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','JWT_ACCESS_TTL','JWT_REFRESH_TTL','DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL','DEEPSEEK_TOOL_MODEL','QWEN_API_KEY','QWEN_BASE_URL','QWEN_MODEL','QWEN_VISION_MODEL','SD_BASE_URL','SD_MODE','SD_TIMEOUT_MS','IMAGE_STORAGE','UPLOAD_DIR','PUBLIC_BASE_URL','ADMIN_EMAILS','AGENT_WORKSPACE_ROOT','AGENT_FULL_ACCESS')
$lines = foreach ($key in $order) { if ($values.ContainsKey($key)) { "$key=$($values[$key])" } }
Set-Content -Path $envFile -Value $lines -Encoding utf8
# Prisma resolves environment files from apps/api when migrations are run there.
Copy-Item -LiteralPath $envFile -Destination (Join-Path $root 'apps\api\.env') -Force
Write-Host "Local API environment is ready: $envFile"
Write-Host 'Existing API keys were preserved. Configure SD_BASE_URL only if A1111 runs on this PC.'
