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
    "shop_owner": "Althaz",
    "room_name": "Heleconia Way",
    "room_number": "739405",
    "exterior": "dark speckled marble storefront with a layered tile roof",
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

**Scan data is never committed to git.** The deployed GitHub Pages site is
the pipeline's state store; git holds only code. `docs/data/` is gitignored.

`pipeline.yml` runs every 2 hours (cron) as a single run with three chained
jobs; data flows between them as workflow artifacts, not commits:
1. **Scrape** — `automation/bin/fetch-site-data` restores the previous
   processed town files + tracking (`added_items`/`removed_items`) +
   `state.json` from the live site into `docs/data/`,
   then runs the scan. Auto mode does one **full** scan per UTC day (the
   first run of the day, gated by `state.json`'s `last_full_scan` date) and
   **smart** scans otherwise. Uploads a `scan-data` artifact (new raw data
   plus the restored previous state the processor needs).
2. **Process** — downloads `scan-data`, runs `processor.rb`, uploads a
   `site-data` artifact (processed town files + tracking + state,
   excluding `raw/`).
3. **Deploy** — downloads `site-data`, stages `docs/` (minus `data/raw/`),
   publishes to GitHub Pages.

A single `bodega-pipeline` concurrency group serializes runs, so there are
no commit/push races and no cross-workflow dispatch. Because a queued run
starts only after the prior run has deployed, the once-per-day full-scan
gate reads an up-to-date `state.json`.

The live site is only ever changed by a successful Deploy, so a failed run
leaves the previous data serving unchanged. For **local** development,
run `automation/bin/fetch-site-data` once to populate `docs/data/`.

Manual dispatch options (`pipeline.yml`, `stage` input):
- `full` — Scrape → Process → Deploy (also what cron runs).
- `deploy-only` — republish current site data without scanning/processing
  (restores from the live site); useful after a `docs/` code change.

The Deploy step attempts the Pages deploy twice (GitHub Pages 5xxs are
common). If a run's Deploy still fails, use **Re-run failed jobs** on that
run — the processed `site-data` artifact persists, so it redeploys without
re-scraping.
