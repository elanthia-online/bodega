# Simple script to extract shield sizes from JSON files

Write-Host "Shield Size Extraction Script"
Write-Host "=============================="

$dataDir = "docs\data"
$jsonFiles = Get-ChildItem -Path $dataDir -Filter "*.json" | Where-Object { $_.Name -ne "removed_items.json" }

$totalShields = 0
$updatedShields = 0

foreach ($file in $jsonFiles) {
    Write-Host "`nProcessing: $($file.Name)"

    try {
        $json = Get-Content $file.FullName -Raw | ConvertFrom-Json
        $fileUpdated = $false

        foreach ($shop in $json.shops) {
            if (-not $shop.inv) { continue }

            foreach ($room in $shop.inv) {
                if (-not $room.items) { continue }

                foreach ($item in $room.items) {
                    $itemName = $item.name
                    if (-not $itemName) { continue }

                    # Skip if already has shieldType
                    if ($item.details.shieldType) { continue }

                    # Look for shield size in raw text
                    if ($item.details.raw) {
                        $shieldSize = $null
                        $isShield = $false

                        foreach ($line in $item.details.raw) {
                            # Check if this is a shield by looking for the shield pattern
                            if ($line -match "is a (tower|large|medium|small|parma|buckler) shield that protects") {
                                $shieldSize = $Matches[1].ToLower()
                                $isShield = $true
                                break
                            }
                        }

                        if ($isShield) {
                            $totalShields++

                            if ($shieldSize) {
                                # Add the shieldType property
                                $item.details | Add-Member -NotePropertyName "shieldType" -NotePropertyValue $shieldSize -Force
                                Write-Host "  Updated: $itemName -> $shieldSize"
                                $fileUpdated = $true
                                $updatedShields++
                            }
                        }
                    }
                }
            }
        }

        # Save file if it was updated
        if ($fileUpdated) {
            $json | ConvertTo-Json -Depth 50 | Set-Content $file.FullName -Encoding UTF8
            Write-Host "  Saved changes to $($file.Name)"
        }
    }
    catch {
        Write-Host "  ERROR processing $($file.Name): $_"
    }
}

Write-Host "`n=============================="
Write-Host "Summary:"
Write-Host "Total shields found: $totalShields"
Write-Host "Shields updated: $updatedShields"
Write-Host "=============================="
