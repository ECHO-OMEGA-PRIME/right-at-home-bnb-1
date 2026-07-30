Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$canonicalRoot = 'C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb'
$fableRoot = 'E:\fable_work\rah-midland'
$outputDirectory = Join-Path $canonicalRoot 'docs\consolidation'

foreach ($requiredRoot in @($canonicalRoot, $fableRoot)) {
    if (-not (Test-Path -LiteralPath $requiredRoot -PathType Container)) {
        throw "Required source root not found: $requiredRoot"
    }
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$excludedDirectoryNames = @(
    '.git',
    'node_modules',
    '.next',
    '.venv',
    '.pytest_cache',
    '.turbo',
    'dist',
    'build',
    'coverage',
    '__pycache__',
    '.cache',
    '.vercel'
)

$excludedRelativePrefixes = @(
    'docs/consolidation/'
)

function Test-ExcludedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativePath,
        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    $normalized = $RelativePath.Replace('\', '/')
    $parts = $normalized -split '/'

    if (@($parts | Where-Object { $excludedDirectoryNames -contains $_ }).Count -gt 0) {
        return $true
    }

    foreach ($prefix in $excludedRelativePrefixes) {
        if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    if ($FileName -match '^\.env($|\.(local|production|development|test)(\.local)?$)') {
        return $true
    }

    return $false
}

function Get-TreeInventory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $rows = [System.Collections.Generic.List[object]]::new()
    $pending = [System.Collections.Generic.Stack[string]]::new()
    $pending.Push($Root)

    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()

        try {
            $children = @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop)
        }
        catch {
            Write-Warning "Skipping unreadable or transient directory: $directory ($($_.Exception.Message))"
            continue
        }

        foreach ($child in $children) {
            $relativePath = $child.FullName.Substring($Root.Length).TrimStart('\')
            $normalized = $relativePath.Replace('\', '/')

            if ($child.PSIsContainer) {
                if ($excludedDirectoryNames -contains $child.Name) {
                    continue
                }

                $skipDirectory = $false
                foreach ($prefix in $excludedRelativePrefixes) {
                    $normalizedPrefix = $prefix.TrimEnd('/')
                    if (
                        $normalized.Equals($normalizedPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
                        $normalized.StartsWith("$normalizedPrefix/", [System.StringComparison]::OrdinalIgnoreCase)
                    ) {
                        $skipDirectory = $true
                        break
                    }
                }

                if (-not $skipDirectory) {
                    $pending.Push($child.FullName)
                }
                continue
            }

            if (Test-ExcludedPath -RelativePath $relativePath -FileName $child.Name) {
                continue
            }

            try {
                $hash = (Get-FileHash -LiteralPath $child.FullName -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
            }
            catch {
                Write-Warning "Skipping unreadable or transient file: $($child.FullName) ($($_.Exception.Message))"
                continue
            }

            $rows.Add([pscustomobject]@{
                path         = $normalized
                size         = $child.Length
                modified_utc = $child.LastWriteTimeUtc.ToString('o')
                sha256       = $hash
            })
        }
    }

    return $rows
}

$canonicalInventory = @(Get-TreeInventory -Root $canonicalRoot)
$fableInventory = @(Get-TreeInventory -Root $fableRoot)

$canonicalMap = @{}
foreach ($item in $canonicalInventory) {
    $canonicalMap[$item.path] = $item
}

$fableMap = @{}
foreach ($item in $fableInventory) {
    $fableMap[$item.path] = $item
}

$allPaths = @($canonicalMap.Keys + $fableMap.Keys | Sort-Object -Unique)
$identicalPaths = [System.Collections.Generic.List[string]]::new()
$contentDifferences = [System.Collections.Generic.List[object]]::new()
$canonicalOnly = [System.Collections.Generic.List[object]]::new()
$fableOnly = [System.Collections.Generic.List[object]]::new()

foreach ($path in $allPaths) {
    $inCanonical = $canonicalMap.ContainsKey($path)
    $inFable = $fableMap.ContainsKey($path)

    if ($inCanonical -and $inFable) {
        if ($canonicalMap[$path].sha256 -eq $fableMap[$path].sha256) {
            $identicalPaths.Add($path)
        }
        else {
            $contentDifferences.Add([pscustomobject]@{
                path      = $path
                canonical = $canonicalMap[$path]
                fable     = $fableMap[$path]
            })
        }
    }
    elseif ($inCanonical) {
        $canonicalOnly.Add($canonicalMap[$path])
    }
    else {
        $fableOnly.Add($fableMap[$path])
    }
}

$generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
$report = [ordered]@{
    generated_utc  = $generatedUtc
    canonical_root = $canonicalRoot
    fable_root     = $fableRoot
    exclusions     = [ordered]@{
        directory_names  = $excludedDirectoryNames
        relative_prefixes = $excludedRelativePrefixes
        secret_env_files = $true
    }
    summary        = [ordered]@{
        canonical_files   = $canonicalInventory.Count
        fable_files       = $fableInventory.Count
        identical         = $identicalPaths.Count
        content_different = $contentDifferences.Count
        canonical_only    = $canonicalOnly.Count
        fable_only        = $fableOnly.Count
    }
    content_different = $contentDifferences
    canonical_only    = $canonicalOnly
    fable_only        = $fableOnly
}

$jsonPath = Join-Path $outputDirectory 'P0_C_VS_FABLE_HASH_DIFF.json'
$markdownPath = Join-Path $outputDirectory 'P0_C_VS_FABLE_HASH_DIFF.md'

$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$markdown = [System.Collections.Generic.List[string]]::new()
$markdown.Add('# P0 C: vs Fable Source Consolidation Hash Diff')
$markdown.Add('')
$markdown.Add("Generated UTC: $generatedUtc")
$markdown.Add('')
$markdown.Add("Canonical: $canonicalRoot")
$markdown.Add("Fable snapshot: $fableRoot")
$markdown.Add('')
$markdown.Add('## Summary')
$markdown.Add('')
$markdown.Add('| Metric | Count |')
$markdown.Add('|---|---:|')
$markdown.Add("| Canonical files | $($canonicalInventory.Count) |")
$markdown.Add("| Fable files | $($fableInventory.Count) |")
$markdown.Add("| Identical | $($identicalPaths.Count) |")
$markdown.Add("| Same path, different content | $($contentDifferences.Count) |")
$markdown.Add("| Canonical-only | $($canonicalOnly.Count) |")
$markdown.Add("| Fable-only | $($fableOnly.Count) |")
$markdown.Add('')
$markdown.Add('## Fable-only files')
$markdown.Add('')

if ($fableOnly.Count -eq 0) {
    $markdown.Add('- None')
}
else {
    foreach ($item in $fableOnly) {
        $markdown.Add("- $($item.path) | $($item.size) bytes | SHA-256 $($item.sha256)")
    }
}

$markdown.Add('')
$markdown.Add('## Same-path content conflicts')
$markdown.Add('')

if ($contentDifferences.Count -eq 0) {
    $markdown.Add('- None')
}
else {
    foreach ($item in $contentDifferences) {
        $markdown.Add("- $($item.path) | canonical $($item.canonical.sha256) | Fable $($item.fable.sha256)")
    }
}

$markdown.Add('')
$markdown.Add('## Canonical-only files')
$markdown.Add('')

if ($canonicalOnly.Count -eq 0) {
    $markdown.Add('- None')
}
else {
    foreach ($item in $canonicalOnly) {
        $markdown.Add("- $($item.path) | $($item.size) bytes | SHA-256 $($item.sha256)")
    }
}

$markdown | Set-Content -LiteralPath $markdownPath -Encoding UTF8

Write-Output "REPORT_JSON=$jsonPath"
Write-Output "REPORT_MD=$markdownPath"
Write-Output "CANONICAL_FILES=$($canonicalInventory.Count)"
Write-Output "FABLE_FILES=$($fableInventory.Count)"
Write-Output "IDENTICAL=$($identicalPaths.Count)"
Write-Output "CONTENT_DIFFERENT=$($contentDifferences.Count)"
Write-Output "CANONICAL_ONLY=$($canonicalOnly.Count)"
Write-Output "FABLE_ONLY=$($fableOnly.Count)"
