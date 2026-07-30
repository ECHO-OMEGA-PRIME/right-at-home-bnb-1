[CmdletBinding()]
param(
    [switch]$RunValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = 'C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb'
$expectedFirebaseProject = 'rightathome-prod'
$outputDirectory = Join-Path $repositoryRoot 'docs\consolidation\evidence'
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$runDirectory = Join-Path $outputDirectory $timestamp

if (-not (Test-Path -LiteralPath $repositoryRoot -PathType Container)) {
    throw "Repository root not found: $repositoryRoot"
}

New-Item -ItemType Directory -Force -Path $runDirectory | Out-Null
Set-Location -LiteralPath $repositoryRoot

function Invoke-CapturedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Executable,
        [Parameter(Mandatory = $false)]
        [string[]]$Arguments = @(),
        [Parameter(Mandatory = $false)]
        [string]$WorkingDirectory = $repositoryRoot
    )

    $stdoutPath = Join-Path $runDirectory "$Name.stdout.log"
    $stderrPath = Join-Path $runDirectory "$Name.stderr.log"
    $startedUtc = (Get-Date).ToUniversalTime().ToString('o')

    try {
        $process = Start-Process -FilePath $Executable `
            -ArgumentList $Arguments `
            -WorkingDirectory $WorkingDirectory `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        return [ordered]@{
            name        = $Name
            executable  = $Executable
            arguments   = $Arguments
            started_utc = $startedUtc
            exit_code   = $process.ExitCode
            stdout      = $stdoutPath
            stderr      = $stderrPath
            status      = if ($process.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }
        }
    }
    catch {
        $_.Exception.Message | Set-Content -LiteralPath $stderrPath -Encoding UTF8
        return [ordered]@{
            name        = $Name
            executable  = $Executable
            arguments   = $Arguments
            started_utc = $startedUtc
            exit_code   = $null
            stdout      = $stdoutPath
            stderr      = $stderrPath
            status      = 'ERROR'
            error       = $_.Exception.Message
        }
    }
}

function Get-JsonFileSummary {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [ordered]@{ exists = $false; path = $Path }
    }

    try {
        $json = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
        return [ordered]@{
            exists       = $true
            path         = $Path
            project_id   = $json.projectId
            org_id       = $json.orgId
            project_name = $json.projectName
            sha256       = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    catch {
        return [ordered]@{
            exists = $true
            path   = $Path
            error  = $_.Exception.Message
        }
    }
}

function Get-EnvironmentPresence {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    $result = [ordered]@{
        path   = $Path
        exists = Test-Path -LiteralPath $Path -PathType Leaf
        vars   = [ordered]@{}
    }

    $parsed = @{}
    if ($result.exists) {
        foreach ($line in Get-Content -LiteralPath $Path) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
                $parsed[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
            }
        }
    }

    foreach ($name in $Names) {
        $present = $parsed.ContainsKey($name)
        $value = if ($present) { [string]$parsed[$name] } else { '' }
        $isPlaceholder =
            $value -match '^(your_|paste_|replace_|changeme|example|xxx|<)' -or
            $value -match 'placeholder'

        $entry = [ordered]@{
            present     = $present
            non_empty   = $present -and -not [string]::IsNullOrWhiteSpace($value)
            placeholder = $isPlaceholder
        }

        if ($name -in @(
            'FIREBASE_PROJECT_ID',
            'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
            'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
            'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
            'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
        )) {
            $entry.public_value = if ($present) { $value } else { $null }
        }

        $result.vars[$name] = $entry
    }

    return $result
}

function Get-LiveCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(30)

    try {
        $response = $client.GetAsync($Url).GetAwaiter().GetResult()
        $contentBytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        return [ordered]@{
            url          = $Url
            status_code  = [int]$response.StatusCode
            location     = if ($response.Headers.Location) { $response.Headers.Location.ToString() } else { $null }
            content_type = if ($response.Content.Headers.ContentType) { $response.Content.Headers.ContentType.ToString() } else { $null }
            bytes        = $contentBytes.Length
        }
    }
    catch {
        return [ordered]@{
            url   = $Url
            error = $_.Exception.Message
        }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

$requiredFirebaseVariables = @(
    'FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'FIREBASE_SERVICE_ACCOUNT'
)

$gitCommands = @(
    Invoke-CapturedCommand -Name 'git_status' -Executable 'git.exe' -Arguments @('status', '--porcelain=v2', '--branch'),
    Invoke-CapturedCommand -Name 'git_remote' -Executable 'git.exe' -Arguments @('remote', '-v'),
    Invoke-CapturedCommand -Name 'git_worktree' -Executable 'git.exe' -Arguments @('worktree', 'list', '--porcelain'),
    Invoke-CapturedCommand -Name 'git_log' -Executable 'git.exe' -Arguments @('log', '-20', '--date=iso-strict', '--pretty=format:%H%x09%ad%x09%an%x09%s')
)

$runtimeRoots = @(
    (Join-Path $repositoryRoot 'apps'),
    (Join-Path $repositoryRoot 'packages'),
    (Join-Path $repositoryRoot 'backend'),
    (Join-Path $repositoryRoot 'bridge')
)
$runtimeExtensions = @('*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.json', '*.yaml', '*.yml')
$runtimeFiles = @()

foreach ($root in $runtimeRoots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
        continue
    }
    foreach ($pattern in $runtimeExtensions) {
        $runtimeFiles += Get-ChildItem -LiteralPath $root -File -Recurse -Force -Filter $pattern
    }
}

$runtimeFiles = @(
    $runtimeFiles |
        Where-Object {
            $_.FullName -notmatch '\\(node_modules|\.next|\.venv|\.pytest_cache|\.turbo|dist|build|coverage|__pycache__|\.cache)\\' -and
            $_.Name -notmatch '^\.env($|\.)'
        } |
        Sort-Object -Property FullName -Unique
)

$legacyFirebaseReferences = @(
    $runtimeFiles |
        Select-String -Pattern 'echo-prime-ai' -SimpleMatch |
        ForEach-Object {
            [ordered]@{
                path = $_.Path.Substring($repositoryRoot.Length).TrimStart('\').Replace('\', '/')
                line = $_.LineNumber
            }
        }
)

$rightAtHomeReferences = @(
    $runtimeFiles |
        Select-String -Pattern $expectedFirebaseProject -SimpleMatch |
        ForEach-Object {
            [ordered]@{
                path = $_.Path.Substring($repositoryRoot.Length).TrimStart('\').Replace('\', '/')
                line = $_.LineNumber
            }
        }
)

$rootVercel = Get-JsonFileSummary -Path (Join-Path $repositoryRoot '.vercel\project.json')
$webVercel = Get-JsonFileSummary -Path (Join-Path $repositoryRoot 'apps\web\.vercel\project.json')
$environmentPresence = Get-EnvironmentPresence `
    -Path (Join-Path $repositoryRoot 'apps\web\.env.local') `
    -Names $requiredFirebaseVariables

$vercelCommand = $null
if (Get-Command 'vercel.cmd' -ErrorAction SilentlyContinue) {
    $vercelCommand = Invoke-CapturedCommand `
        -Name 'vercel_env_ls' `
        -Executable 'vercel.cmd' `
        -Arguments @('env', 'ls', 'production') `
        -WorkingDirectory (Join-Path $repositoryRoot 'apps\web')
}
elseif (Get-Command 'vercel.exe' -ErrorAction SilentlyContinue) {
    $vercelCommand = Invoke-CapturedCommand `
        -Name 'vercel_env_ls' `
        -Executable 'vercel.exe' `
        -Arguments @('env', 'ls', 'production') `
        -WorkingDirectory (Join-Path $repositoryRoot 'apps\web')
}

$sourceDiff = $null
$sourceDiffScript = Join-Path $repositoryRoot 'tools\p0_compare_sources.ps1'
if (Test-Path -LiteralPath $sourceDiffScript -PathType Leaf) {
    $sourceDiff = Invoke-CapturedCommand `
        -Name 'source_hash_diff' `
        -Executable 'powershell.exe' `
        -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $sourceDiffScript)
}

$liveChecks = @()
foreach ($url in @(
    'https://rah-midland.com/',
    'https://rah-midland.com/properties',
    'https://rah-midland.com/properties/new',
    'https://rah-midland.com/api/health',
    'https://api.rah-midland.com/health'
)) {
    $liveChecks += Get-LiveCheck -Url $url
}

$validation = @()
if ($RunValidation) {
    $validation += Invoke-CapturedCommand `
        -Name 'p0_static_assertions' `
        -Executable 'node.exe' `
        -Arguments @('.\tools\p0_static_assertions.mjs')
    $validation += Invoke-CapturedCommand `
        -Name 'web_typecheck' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/web', 'exec', 'tsc', '--noEmit')
    $validation += Invoke-CapturedCommand `
        -Name 'web_prisma_validate' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/web', 'exec', 'prisma', 'validate')
    $validation += Invoke-CapturedCommand `
        -Name 'mobile_typecheck' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/mobile', 'exec', 'tsc', '--noEmit')
    $validation += Invoke-CapturedCommand `
        -Name 'backend_compileall' `
        -Executable 'python.exe' `
        -Arguments @('-m', 'compileall', '-q', 'backend')
    $validation += Invoke-CapturedCommand `
        -Name 'web_build' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/web', 'build')
    $validation += Invoke-CapturedCommand `
        -Name 'root_tests' `
        -Executable 'pnpm.cmd' `
        -Arguments @('test')
}

$projectIdEntry = $environmentPresence.vars['NEXT_PUBLIC_FIREBASE_PROJECT_ID']
$serverProjectIdEntry = $environmentPresence.vars['FIREBASE_PROJECT_ID']
$clientProjectMatches =
    $projectIdEntry.present -and
    $projectIdEntry.public_value -eq $expectedFirebaseProject
$serverProjectMatches =
    $serverProjectIdEntry.present -and
    $serverProjectIdEntry.public_value -eq $expectedFirebaseProject

$firebaseAuthorityState = if (-not $projectIdEntry.present -or -not $serverProjectIdEntry.present) {
    'MISSING'
}
elseif (-not $clientProjectMatches -or -not $serverProjectMatches) {
    'CONFLICT'
}
elseif ($legacyFirebaseReferences.Count -gt 0) {
    'SOURCE_CONFLICT'
}
else {
    'CONSISTENT'
}

$vercelProjectConsistent =
    $rootVercel.exists -and
    $webVercel.exists -and
    $rootVercel.project_id -eq $webVercel.project_id -and
    $rootVercel.project_name -eq 'right-at-home-bnb' -and
    $webVercel.project_name -eq 'right-at-home-bnb'

$validationPass = $true
if ($RunValidation) {
    $validationPass = @($validation | Where-Object { $_.status -ne 'PASS' }).Count -eq 0
}

$verificationState = if (
    $firebaseAuthorityState -eq 'CONSISTENT' -and
    $vercelProjectConsistent -and
    $validationPass
) {
    'PASS'
}
else {
    'FAIL'
}

$report = [ordered]@{
    generated_utc               = (Get-Date).ToUniversalTime().ToString('o')
    verification_state          = $verificationState
    repository_root             = $repositoryRoot
    expected_firebase_project   = $expectedFirebaseProject
    firebase_authority_state    = $firebaseAuthorityState
    vercel_project_consistent   = $vercelProjectConsistent
    root_vercel_project         = $rootVercel
    web_vercel_project          = $webVercel
    local_environment_presence  = $environmentPresence
    legacy_firebase_references  = $legacyFirebaseReferences
    expected_project_references = $rightAtHomeReferences
    git_commands                = $gitCommands
    vercel_environment_command  = $vercelCommand
    source_hash_diff_command    = $sourceDiff
    live_checks                 = $liveChecks
    validation                  = $validation
}

$jsonPath = Join-Path $runDirectory 'P0_ENVIRONMENT_VERIFICATION.json'
$markdownPath = Join-Path $runDirectory 'P0_ENVIRONMENT_VERIFICATION.md'
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$markdown = [System.Collections.Generic.List[string]]::new()
$markdown.Add('# RAH Midland P0 Environment Verification')
$markdown.Add('')
$markdown.Add("Generated UTC: $($report.generated_utc)")
$markdown.Add('')
$markdown.Add("- Verification state: $verificationState")
$markdown.Add("- Repository: $repositoryRoot")
$markdown.Add("- Expected Firebase project: $expectedFirebaseProject")
$markdown.Add("- Firebase authority state: $firebaseAuthorityState")
$markdown.Add("- Legacy runtime Firebase references: $($legacyFirebaseReferences.Count)")
$markdown.Add("- rightathome-prod runtime references: $($rightAtHomeReferences.Count)")
$markdown.Add("- Root Vercel project: $($rootVercel.project_name)")
$markdown.Add("- Web Vercel project: $($webVercel.project_name)")
$markdown.Add("- Vercel project consistent: $vercelProjectConsistent")
$markdown.Add('')
$markdown.Add('## Command results')
$markdown.Add('')

foreach ($command in @($gitCommands) + @($vercelCommand) + @($sourceDiff) + @($validation)) {
    if ($null -ne $command) {
        $markdown.Add("- $($command.name): $($command.status) (exit $($command.exit_code))")
    }
}

$markdown.Add('')
$markdown.Add('## Live checks')
$markdown.Add('')
foreach ($check in $liveChecks) {
    if ($check.Contains('status_code')) {
        $markdown.Add("- $($check.url): HTTP $($check.status_code)")
    }
    else {
        $markdown.Add("- $($check.url): ERROR - $($check.error)")
    }
}

$markdown.Add('')
$markdown.Add('## Safety')
$markdown.Add('')
$markdown.Add('- Secret values are never written to the report.')
$markdown.Add('- This script does not add, remove, or modify Vercel environment variables.')
$markdown.Add('- This script does not deploy, commit, reset, clean, stash, copy, or delete source files.')
$markdown.Add('- Validation runs only when -RunValidation is supplied.')
$markdown | Set-Content -LiteralPath $markdownPath -Encoding UTF8

Write-Output "REPORT_JSON=$jsonPath"
Write-Output "REPORT_MD=$markdownPath"
Write-Output "VERIFICATION_STATE=$verificationState"
Write-Output "FIREBASE_AUTHORITY_STATE=$firebaseAuthorityState"
Write-Output "VERCEL_PROJECT_CONSISTENT=$vercelProjectConsistent"
Write-Output "LEGACY_FIREBASE_REFERENCES=$($legacyFirebaseReferences.Count)"
Write-Output "EXPECTED_PROJECT_REFERENCES=$($rightAtHomeReferences.Count)"

if ($verificationState -ne 'PASS') {
    exit 1
}
