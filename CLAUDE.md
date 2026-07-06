# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GemStone IV Bodega is a player shop browser that combines a static web application with automated data collection from the game using the Lich Ruby framework.

## Development Commands

### Local Web Development
```bash
cd docs && python -m http.server 8000
```

### Automation Testing (requires game credentials)
```bash
export SIMU_USERNAME="username" SIMU_PASSWORD="password" SIMU_CHARACTER="character"
./automation/bin/setup-environment
./automation/bin/run-scan          # No arg: smart scan (CI passes an explicit type)
./automation/bin/run-scan smart    # Force smart scan
./automation/bin/run-scan full     # Force full scan
```

### Local Data Processing (Windows)
```bash
ruby automation/ruby/processor.rb --mode=reprocess
```

## Architecture

### Separation of Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **bodega.lic** | Raw data capture ONLY - saves `raw_inspect` text to `docs/data/raw/*.json` |
| **processor.rb** | ALL extraction - tags, properties, item types → outputs to `docs/data/*.json` |
| **data-loader.js** | Display ONLY - loads processed data, no parsing/fallback |

### Data Pipeline
```
bodega.lic (in-game) → docs/data/raw/*.json
                            ↓
processor.rb (server) → docs/data/*.json
                            ↓
data-loader.js (browser) → Web UI
```

### Key Files
| File | Purpose |
|------|---------|
| `automation/lich/scripts/bodega.lic` | In-game raw capture (`;bodega` or `;bodega --smart`) |
| `automation/lich/scripts/headless.lic` | Headless automation entry point |
| `automation/ruby/processor.rb` | Extracts ALL properties from raw data |
| `automation/ruby/bodega_extractor.rb` | Pattern matching and extraction logic |
| `docs/assets/js/core/data-loader.js` | Loads and displays processed data |

### Data Directories
- `docs/data/raw/` - Raw JSON from bodega.lic (per-town files)
- `docs/data/` - Processed JSON consumed by web app
- `docs/data/added_items.json` - Tracks when items were first seen
- `docs/data/removed_items.json` - Tracks removed items

### Scan Types
- **Full scan**: `;bodega` - Complete shop inventory inspection (~65 min)
- **Smart scan**: `;bodega --smart` - Only inspects new/changed items (~2-3 min)
- Automation runs one full scan per UTC day (the first scheduled run of the
  day, gated by the `automation/state/last-full-scan` marker) and smart scans
  every 2 hours otherwise

## Extracted Properties

processor.rb extracts these fields from raw inspection text:
- **Basic**: cost, enchant, material, skill, weight, worn
- **Combat**: flare/flares, sanctify, ensorcell, dmg_padding, crit_padding, dmg_weighting, crit_weighting
- **Type flags**: is_weapon, is_armor, is_shield, is_container, is_jewelry, is_gemstone
- **Classification**: item_type, armor_type, weapon_type, shield_type, wear_location
- **Special**: enhancives, gemstone_properties, forged_quality, blessing, charges, spell, tags

## Code Patterns

### Item Signature Generation
Items are tracked using signatures (used in `added_items.json`):
```ruby
# Ruby (bodega.lic)
"#{safe_town}:#{safe_shop}:#{item_name}:#{price}"
```

### Processed JSON Schema
```json
{
  "town": "Wehnimer's Landing",
  "created_at": "2025-01-01T00:00:00Z",
  "processing_version": "v2.0",
  "shops": [{
    "id": "12345",
    "preamble": "Shop location description",
    "inv": [{
      "room_title": "Room Name",
      "items": [{
        "id": "67890",
        "name": "a vultite sword",
        "details": {
          "raw": ["inspection text..."],
          "tags": ["scripted"],
          "cost": 50000,
          "enchant": 25,
          "is_weapon": true,
          "item_type": "weapon",
          "weapon_type": "edged weapons"
        }
      }]
    }]
  }]
}
```

## CI/CD
The three data-mutating workflows run in a chain, each dispatching the next
after it pushes changes to `master`:
- `automation.yml` (Scrape): runs every 2 hours via cron. Auto mode runs one
  **full** scan per UTC day — the first run of the day, gated by the
  `automation/state/last-full-scan` date marker — and **smart** scans for the
  rest. On changes, dispatches `process-data.yml`.
- `process-data.yml` (Process): runs `processor.rb` over the raw data. On
  changes, dispatches `deploy.yml`.
- `deploy.yml` (Deploy): `workflow_dispatch` only (triggered by the process
  step). Publishes `docs/` to GitHub Pages.
- `update-map-ids.yml` (Update Map IDs): `workflow_dispatch` only. Scrapes
  ps.lichproject.org and updates `docs/data/shop_mapping.json`.

All three pushers rebase-and-retry against the live `master` tip to avoid
races, and declare least-privilege `permissions` blocks.
