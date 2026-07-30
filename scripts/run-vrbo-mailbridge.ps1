[CmdletBinding()]
param(
    [ValidateRange(1, 5000)]
    [int]$MaxMessages = 250,

    [switch]$DryRun,

    [switch]$ReconcileOnly,

    [switch]$IcalOnly,

    [switch]$SkipIcal,

    [switch]$Status
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($IcalOnly -and $SkipIcal) {
    throw '-IcalOnly and -SkipIcal cannot be combined.'
}
if ($ReconcileOnly -and $IcalOnly) {
    throw '-ReconcileOnly and -IcalOnly cannot be combined.'
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $RepoRoot 'backend'
$MailBridgeModuleRoot = Join-Path $BackendRoot 'services'
$LogRoot = Join-Path $RepoRoot 'logs\vrbo-mailbridge'
$LockPath = Join-Path $LogRoot 'worker.lock'

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

if ($env:VRBO_MAIL_SHADOW_MODE -and $env:VRBO_MAIL_SHADOW_MODE -notmatch '^(?i:true|1|yes|on)$') {
    throw 'VRBO_MAIL_SHADOW_MODE must remain true in Phase 1.'
}
$env:VRBO_MAIL_SHADOW_MODE = 'true'
$env:PYTHONPATH = $MailBridgeModuleRoot

$PythonCandidates = @(
    (Join-Path $BackendRoot '.venv\Scripts\python.exe'),
    (Join-Path $RepoRoot '.venv\Scripts\python.exe'),
    'python.exe',
    'python'
)

$Python = $null
foreach ($Candidate in $PythonCandidates) {
    if (Test-Path -LiteralPath $Candidate) {
        $Python = $Candidate
        break
    }
    $Command = Get-Command $Candidate -ErrorAction SilentlyContinue
    if ($Command) {
        $Python = $Command.Source
        break
    }
}
if (-not $Python) {
    throw 'Python runtime was not found.'
}

$LockStream = $null
try {
    $LockStream = [System.IO.File]::Open(
        $LockPath,
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
} catch {
    throw 'Another Vrbo MailBridge run is already active.'
}

try {
    $Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $LogPath = Join-Path $LogRoot "$Timestamp.jsonl"
    $Arguments = @('-m', 'vrbo_mailbridge.run_once')

    if ($DryRun) {
        $Arguments += '--dry-run'
    }
    if ($ReconcileOnly) {
        $Arguments += '--reconcile-only'
    }
    if ($IcalOnly) {
        $Arguments += '--ical-only'
    }
    if ($SkipIcal) {
        $Arguments += '--skip-ical'
    }
    if ($Status) {
        $Arguments += '--status'
    }
    if (-not $Status -and -not $ReconcileOnly -and -not $IcalOnly) {
        $Arguments += @('--max-messages', $MaxMessages.ToString())
    }

    Push-Location $RepoRoot
    try {
        & $Python @Arguments 2>&1 | Tee-Object -FilePath $LogPath
        $ExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if ($null -eq $ExitCode) {
        $ExitCode = 1
    }
    exit $ExitCode
} finally {
    if ($LockStream) {
        $LockStream.Dispose()
    }
    Remove-Item -LiteralPath $LockPath -Force -ErrorAction SilentlyContinue
}
