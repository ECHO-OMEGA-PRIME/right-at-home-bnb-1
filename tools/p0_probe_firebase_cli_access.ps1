$ErrorActionPreference = 'Continue'

$root = 'C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb'
$firebase = 'C:\Users\bobmc\AppData\Roaming\npm\firebase.ps1'
$gcloud = 'C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.ps1'
$out = Join-Path $root 'docs\consolidation\P0_FIREBASE_CLI_ACCESS.json'

function Convert-SafeJson {
    param([object[]]$Lines)
    try {
        return (($Lines -join "`n") | ConvertFrom-Json)
    }
    catch {
        return $null
    }
}

function Find-Emails {
    param($Value)
    if ($null -eq $Value) { return @() }
    $json = $Value | ConvertTo-Json -Depth 30
    return @(
        [regex]::Matches($json, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}') |
            ForEach-Object { $_.Value } |
            Sort-Object -Unique
    )
}

function Find-ProjectIds {
    param($Value)
    if ($null -eq $Value) { return @() }
    $json = $Value | ConvertTo-Json -Depth 30
    return @(
        [regex]::Matches($json, '"projectId"\s*:\s*"([^"]+)"') |
            ForEach-Object { $_.Groups[1].Value } |
            Sort-Object -Unique
    )
}

$login = & $firebase login:list --json 2>&1
$loginCode = $LASTEXITCODE
$projects = & $firebase projects:list --json 2>&1
$projectsCode = $LASTEXITCODE
$gaccounts = & $gcloud auth list --format=json 2>&1
$gCode = $LASTEXITCODE

$loginJson = Convert-SafeJson $login
$projectsJson = Convert-SafeJson $projects
$gcloudJson = Convert-SafeJson $gaccounts

$projectIds = Find-ProjectIds $projectsJson
$result = [ordered]@{
    checked_utc = (Get-Date).ToUniversalTime().ToString('o')
    firebase_login_exit_code = $loginCode
    firebase_accounts = @(Find-Emails $loginJson)
    firebase_projects_exit_code = $projectsCode
    firebase_project_ids = @($projectIds)
    rightathome_visible = ($projectIds -contains 'rightathome-prod')
    gcloud_exit_code = $gCode
    gcloud_accounts = @(Find-Emails $gcloudJson)
}

$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $out -Encoding UTF8
$result | ConvertTo-Json -Depth 6
exit 0
