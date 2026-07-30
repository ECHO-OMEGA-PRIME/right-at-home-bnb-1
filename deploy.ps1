[CmdletBinding()]
param(
    [ValidateSet('validate', 'web', 'backend', 'mobile', 'desktop', 'all')]
    [string]$Target = 'validate',

    [ValidateSet('preview', 'production')]
    [string]$Environment = 'production',

    [string]$Confirmation = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot
$ExpectedFirebaseProject = 'rightathome-prod'
$ProductionConfirmation = 'DEPLOY_RAH_PRODUCTION'

function Assert-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command is unavailable: $Name"
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host "[CHECK] $Name" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

function Assert-DeploymentAuthority {
    $clientProject = $env:NEXT_PUBLIC_FIREBASE_PROJECT_ID
    $serverProject = $env:FIREBASE_PROJECT_ID

    if ($clientProject -ne $ExpectedFirebaseProject) {
        throw "NEXT_PUBLIC_FIREBASE_PROJECT_ID must equal $ExpectedFirebaseProject"
    }
    if ($serverProject -ne $ExpectedFirebaseProject) {
        throw "FIREBASE_PROJECT_ID must equal $ExpectedFirebaseProject"
    }

    $projectFile = Join-Path $ProjectRoot 'apps\web\.vercel\project.json'
    if (-not (Test-Path -LiteralPath $projectFile -PathType Leaf)) {
        throw "Vercel project linkage is missing: $projectFile"
    }

    $project = Get-Content -LiteralPath $projectFile -Raw | ConvertFrom-Json
    if ($project.projectName -ne 'right-at-home-bnb') {
        throw "Unexpected Vercel project: $($project.projectName)"
    }
}

function Invoke-Validation {
    Assert-CommandAvailable -Name 'git.exe'
    Assert-CommandAvailable -Name 'node.exe'
    Assert-CommandAvailable -Name 'pnpm.cmd'

    Push-Location $ProjectRoot
    try {
        Invoke-Checked -Name 'P0 static assertions' -Command {
            node .\tools\p0_static_assertions.mjs
        }
        Invoke-Checked -Name 'Web TypeScript validation' -Command {
            pnpm --dir apps/web exec tsc --noEmit
        }
        Invoke-Checked -Name 'Web Prisma schema validation' -Command {
            pnpm --dir apps/web exec prisma validate
        }
        Invoke-Checked -Name 'Web production build' -Command {
            pnpm --dir apps/web build
        }
    }
    finally {
        Pop-Location
    }
}

function Assert-ProductionGate {
    if ($Environment -ne 'production') {
        return
    }

    if ($Confirmation -ne $ProductionConfirmation) {
        throw "Production deployment requires -Confirmation $ProductionConfirmation"
    }

    $dirty = & git.exe -C $ProjectRoot status --porcelain
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to determine Git working-tree state'
    }
    if ($dirty) {
        throw 'Production deployment requires a clean Git working tree'
    }

    Assert-DeploymentAuthority
}

function Deploy-Web {
    Assert-CommandAvailable -Name 'vercel.cmd'
    Assert-ProductionGate

    Push-Location (Join-Path $ProjectRoot 'apps\web')
    try {
        if ($Environment -eq 'production') {
            Invoke-Checked -Name 'Vercel production deployment' -Command {
                vercel --prod --yes
            }
        }
        else {
            Invoke-Checked -Name 'Vercel preview deployment' -Command {
                vercel --yes
            }
        }
    }
    finally {
        Pop-Location
    }
}

function Deploy-Backend {
    throw (
        'Legacy Cloud Run/Railway deployment is disabled. ' +
        'Deploy the RAH API only through the verified Echo/FORGE service manifest, ' +
        'with an immutable commit and rollback evidence.'
    )
}

function Build-Mobile {
    Assert-CommandAvailable -Name 'eas.cmd'
    Assert-ProductionGate

    Push-Location (Join-Path $ProjectRoot 'apps\mobile')
    try {
        $profile = if ($Environment -eq 'production') { 'production' } else { 'preview' }
        Invoke-Checked -Name "EAS $profile build" -Command {
            eas build --platform all --profile $profile --non-interactive
        }
    }
    finally {
        Pop-Location
    }
}

function Build-Desktop {
    Assert-ProductionGate

    Push-Location (Join-Path $ProjectRoot 'apps\desktop')
    try {
        Invoke-Checked -Name 'Desktop Windows build' -Command {
            pnpm build:win
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "RAH Midland deployment gate" -ForegroundColor Cyan
Write-Host "Target: $Target"
Write-Host "Environment: $Environment"

Invoke-Validation

switch ($Target) {
    'validate' { Write-Host 'Validation completed. No deployment requested.' -ForegroundColor Green }
    'web' { Deploy-Web }
    'backend' { Deploy-Backend }
    'mobile' { Build-Mobile }
    'desktop' { Build-Desktop }
    'all' {
        Deploy-Backend
        Deploy-Web
        Build-Mobile
        Build-Desktop
    }
}
