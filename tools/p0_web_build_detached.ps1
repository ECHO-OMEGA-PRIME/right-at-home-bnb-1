Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = 'C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb'
$evidence = Join-Path $root 'docs\consolidation'
$started = Join-Path $evidence 'P0_WEB_BUILD_STARTED.txt'
$completed = Join-Path $evidence 'P0_WEB_BUILD_COMPLETED.txt'
$stdout = Join-Path $evidence 'P0_WEB_BUILD_OUTPUT.txt'
$stderr = Join-Path $evidence 'P0_WEB_BUILD_ERROR.txt'

New-Item -ItemType Directory -Force -Path $evidence | Out-Null
Remove-Item -LiteralPath $completed, $stdout, $stderr -Force -ErrorAction SilentlyContinue
(Get-Date).ToUniversalTime().ToString('o') | Set-Content -LiteralPath $started -Encoding UTF8

$env:DATABASE_URL = 'postgresql://rah_ci:rah_ci@127.0.0.1:5432/rah_ci'
$env:DIRECT_URL = $env:DATABASE_URL
$env:FIREBASE_PROJECT_ID = 'rightathome-prod'
$env:FIREBASE_STORAGE_BUCKET = 'rightathome-prod.appspot.com'
$env:NEXT_PUBLIC_FIREBASE_API_KEY = 'ci-placeholder-api-key'
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'rightathome-prod.firebaseapp.com'
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'rightathome-prod'
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'rightathome-prod.appspot.com'
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '000000000000'
$env:NEXT_PUBLIC_FIREBASE_APP_ID = '1:000000000000:web:ci-placeholder'
$env:NEXT_PUBLIC_API_URL = 'https://api.rah-midland.com'

Set-Location -LiteralPath $root
$process = Start-Process -FilePath 'pnpm.cmd' `
    -ArgumentList @('--dir', 'apps/web', 'build') `
    -WorkingDirectory $root `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr

@(
    "completed_utc=$((Get-Date).ToUniversalTime().ToString('o'))",
    "exit_code=$($process.ExitCode)",
    "stdout=$stdout",
    "stderr=$stderr"
) | Set-Content -LiteralPath $completed -Encoding UTF8

exit $process.ExitCode
