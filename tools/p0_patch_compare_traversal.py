from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\tools\p0_compare_sources.ps1")
text = path.read_text(encoding="utf-8")
old = r'''function Get-TreeInventory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $rows = [System.Collections.Generic.List[object]]::new()

    Get-ChildItem -LiteralPath $Root -File -Recurse -Force | ForEach-Object {
        $relativePath = $_.FullName.Substring($Root.Length).TrimStart('\')
        if (Test-ExcludedPath -RelativePath $relativePath -FileName $_.Name) {
            return
        }

        $rows.Add([pscustomobject]@{
            path         = $relativePath.Replace('\', '/')
            size         = $_.Length
            modified_utc = $_.LastWriteTimeUtc.ToString('o')
            sha256       = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        })
    }

    return $rows
}
'''
new = r'''function Get-TreeInventory {
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
'''
if old not in text:
    raise SystemExit("Original Get-TreeInventory block not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
