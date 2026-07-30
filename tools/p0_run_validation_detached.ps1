Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = 'C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb'
$evidence = Join-Path $root 'docs\consolidation'
$started = Join-Path $evidence 'P0_VALIDATION_DETACHED_STARTED.txt'
$completed = Join-Path $evidence 'P0_VALIDATION_DETACHED_COMPLETED.txt'
$output = Join-Path $evidence 'P0_VERIFY_LATEST_OUTPUT.txt'

New-Item -ItemType Directory -Force -Path $evidence | Out-Null
Remove-Item -LiteralPath $completed -Force -ErrorAction SilentlyContinue
(Get-Date).ToUniversalTime().ToString('o') | Set-Content -LiteralPath $started -Encoding UTF8

Set-Location -LiteralPath $root
$lines = & '.\tools\p0_verify_environment.ps1' -RunValidation 2>&1
$exitCode = $LASTEXITCODE
$lines | Set-Content -LiteralPath $output -Encoding UTF8

@(
    "completed_utc=$((Get-Date).ToUniversalTime().ToString('o'))",
    "exit_code=$exitCode",
    "output=$output"
) | Set-Content -LiteralPath $completed -Encoding UTF8

exit $exitCode
