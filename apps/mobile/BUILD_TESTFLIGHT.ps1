# Right at Home BnB - iOS TestFlight Build Script
# Run this script INTERACTIVELY to set up credentials and build

Write-Host "=== Right at Home BnB iOS Build ===" -ForegroundColor Cyan
Write-Host "Apple ID: echoprime76@icloud.com" -ForegroundColor Yellow
Write-Host "Team ID: W54TFAVXS2" -ForegroundColor Yellow
Write-Host ""

# Set environment variables for Apple credentials
$env:EXPO_APPLE_ID = "echoprime76@icloud.com"
$env:EXPO_APPLE_PASSWORD = "Imissus69@@"

# Change to mobile app directory
Set-Location "P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\mobile"

Write-Host "Step 1: Setting up iOS credentials..." -ForegroundColor Green
Write-Host "You may be prompted to log in to Apple Developer." -ForegroundColor Yellow
Write-Host ""

# Run credentials setup
npx eas credentials --platform ios

Write-Host ""
Write-Host "Step 2: Starting iOS build for TestFlight..." -ForegroundColor Green

# Run the build
npx eas build --platform ios --profile production

Write-Host ""
Write-Host "Step 3: Submitting to TestFlight..." -ForegroundColor Green

# Submit to TestFlight
npx eas submit --platform ios --profile production

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Cyan
