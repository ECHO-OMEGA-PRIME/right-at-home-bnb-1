Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = 'C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb'
$evidence = Join-Path $root 'docs\consolidation'
$started = Join-Path $evidence 'P0_WORKSPACE_TESTS_STARTED.txt'
$completed = Join-Path $evidence 'P0_WORKSPACE_TESTS_COMPLETED.txt'
$stdout = Join-Path $evidence 'P0_WORKSPACE_TESTS_OUTPUT.txt'
$stderr = Join-Path $evidence 'P0_WORKSPACE_TESTS_ERROR.txt'

New-Item -ItemType Directory -Force -Path $evidence | Out-Null
Remove-Item -LiteralPath $completed, $stdout, $stderr -Force -ErrorAction SilentlyContinue
(Get-Date).ToUniversalTime().ToString('o') | Set-Content -LiteralPath $started -Encoding UTF8

Set-Location -LiteralPath $root
$process = Start-Process -FilePath 'pnpm.cmd' `
    -ArgumentList @('test') `
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
