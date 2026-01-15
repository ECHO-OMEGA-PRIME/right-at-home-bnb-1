# Right at Home BnB - Deployment Script
# Deploys all platforms: Web, Backend, Mobile, Desktop
# Usage: .\deploy.ps1 -Target [all|web|backend|mobile|desktop]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("all", "web", "backend", "mobile", "desktop")]
    [string]$Target = "all",

    [Parameter(Mandatory=$false)]
    [ValidateSet("development", "preview", "production")]
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host "
╔═══════════════════════════════════════════════════════════╗
║     RIGHT AT HOME BnB - DEPLOYMENT SCRIPT                  ║
║     Steven Palma | Midland, TX | 22 Properties             ║
╠═══════════════════════════════════════════════════════════╣
║     Target: $Target
║     Environment: $Environment
╚═══════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

function Deploy-Web {
    Write-Host "`n[WEB] Deploying to Vercel..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\apps\web"

    try {
        # Install dependencies
        npm install

        # Build
        npm run build

        # Deploy
        if ($Environment -eq "production") {
            vercel --prod --yes
        } else {
            vercel --yes
        }

        Write-Host "[WEB] Deployed successfully!" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Deploy-Backend {
    Write-Host "`n[BACKEND] Deploying to Cloud Run..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\backend"

    try {
        # Build and deploy using gcloud
        gcloud builds submit --config cloudbuild.yaml --project echo-prime-ai

        Write-Host "[BACKEND] Deployed successfully!" -ForegroundColor Green

        # Get service URL
        $url = gcloud run services describe rightathome-api --platform managed --region us-central1 --format 'value(status.url)' 2>$null
        Write-Host "[BACKEND] Service URL: $url" -ForegroundColor Cyan
    }
    finally {
        Pop-Location
    }
}

function Deploy-Mobile {
    Write-Host "`n[MOBILE] Building with EAS..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\apps\mobile"

    try {
        # Install dependencies
        npm install

        # Build for both platforms
        if ($Environment -eq "production") {
            eas build --platform all --profile production --non-interactive
        } elseif ($Environment -eq "preview") {
            eas build --platform all --profile preview --non-interactive
        } else {
            eas build --platform all --profile development --non-interactive
        }

        Write-Host "[MOBILE] Build submitted to EAS!" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Deploy-Desktop {
    Write-Host "`n[DESKTOP] Building Electron app..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\apps\desktop"

    try {
        # Install dependencies
        npm install

        # Build for Windows
        npm run build:win

        # Build for macOS (if on Mac)
        if ($IsMacOS) {
            npm run build:mac
        }

        Write-Host "[DESKTOP] Build complete!" -ForegroundColor Green
        Write-Host "[DESKTOP] Installers in: $ProjectRoot\apps\desktop\dist" -ForegroundColor Cyan
    }
    finally {
        Pop-Location
    }
}

# Execute deployment based on target
switch ($Target) {
    "all" {
        Deploy-Backend
        Deploy-Web
        Deploy-Mobile
        Deploy-Desktop
    }
    "web" { Deploy-Web }
    "backend" { Deploy-Backend }
    "mobile" { Deploy-Mobile }
    "desktop" { Deploy-Desktop }
}

Write-Host "`n
╔═══════════════════════════════════════════════════════════╗
║                 DEPLOYMENT COMPLETE                        ║
╚═══════════════════════════════════════════════════════════╝
" -ForegroundColor Green
