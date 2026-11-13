# Bodega Consolidated

**GemStone IV Player Shop Browser - Unified Repository**

A comprehensive solution combining advanced web interface with automated data collection for GemStone IV player shops (bodegas).

## Overview

This consolidated repository merges the best of both worlds:
- **Advanced Web Application**: Sophisticated search, browse, and filtering capabilities
- **Ruby Automation System**: Clean, efficient automated data collection using enhanced Ruby patterns
- **Modern Infrastructure**: GitHub-native with automated CI/CD pipelines

## Features

### Web Application
- **Advanced Search**: Quoted phrases, `*` wildcards, `OR`, `-exclude`, optional regex, plus filters for item type, enchant, worn location, container size, armor, shield, weapon, gemstone, town and price
- **Browse Mode**: Hierarchical navigation through towns → shops → rooms → items, plus shop-sign search
- **Recently Added**: Newly listed items (last 24 hours by default, up to all time)
- **Recently Removed**: Items that left shops (kept 14–180 days depending on data size)
- **Shareable Links**: Items, shops and searches (filters, sort and page) all live in the URL; links also unfurl with a preview image in Discord and similar apps
- **Mobile Friendly**: Filters fold behind a toggle on small screens; the results table scrolls sideways
- **Accessible**: Keyboard-operable throughout, screen-reader labels and announcements, native modal dialogs, light/dark/high-contrast themes and A-/A/A+ text size (see [ACCESSIBILITY_PLAN.md](ACCESSIBILITY_PLAN.md))

### Automation System
- **Smart Scanning**: 90%+ efficiency improvement via intelligent caching
- **Dual Mode Operation**: Smart scans (2-3 minutes) vs Full scans (65 minutes)
- **Clean Ruby Integration**: Proper module structure inspired by original author
- **Automated Scheduling**: Runs every 2 hours via GitHub Actions
- **No data in git**: Scan data is published straight to GitHub Pages; git holds only code

## Architecture

```
bodega/
├── docs/                    # Web application (published to GitHub Pages)
│   ├── index.html           # Main UI
│   ├── assets/css/          # main.css, themes.css
│   ├── assets/js/core/      # data loading, URL state, shared helpers, theme
│   ├── assets/js/components/# search, browse, added, removed views
│   ├── assets/js/config/    # tag categories
│   └── data/                # Generated JSON (gitignored; lives on the site)
├── automation/              # Ruby automation system
│   ├── bin/                 # setup-environment, run-scan, fetch-site-data
│   ├── ruby/                # processor.rb, bodega_extractor.rb
│   ├── lich/                # Lich environment
│   │   └── scripts/bodega.lic  # In-game raw capture
│   └── tools/               # Pipeline helpers
├── .github/workflows/
│   └── pipeline.yml         # Scrape -> Process -> Deploy (one run, artifacts)
└── README.md
```

## Quick Start

### For Users
Visit the web interface: [Bodega](https://shops.elanthia.online/)

### For Contributors
1. Fork this repository
2. Make your changes
3. Submit a pull request

### For Data Collection (Automation)
The site automatically updates every 2 hours via `pipeline.yml`. Scan data
is not committed to git — it is restored from the live site each run, passed
between the Scrape/Process/Deploy jobs as artifacts, and published straight
to GitHub Pages. For local development, run `automation/bin/fetch-site-data`
once to populate `docs/data/`.

## Automation System

### Scan Types
- **Smart Scan** (default): Only inspects new/changed items - 90% faster
- **Full Scan** (first scheduled run each UTC day): Comprehensive scan of all shops

### How a scan runs
`automation/bin/run-scan` starts Lich headless with
`automation/lich/scripts/headless.lic`, which runs `bodega.lic` in raw-capture
mode. The scan type is chosen by the workflow (one full scan per UTC day, gated
by the `last_full_scan` date in `docs/data/state.json`) and passed to
`run-scan`, which hands it to `headless.lic` as `BODEGA_SCAN_TYPE`:

```ruby
# automation/lich/scripts/headless.lic
if scan_type == 'full'
  # Smart pass first (to catch removals), then full inspection
  Script.run("bodega", "--parser --smart --save --raw-only")
  Script.run("bodega", "--parser --save --raw-only")
else
  Script.run("bodega", "--parser --smart --save --raw-only")
end
```

`--raw-only` saves the raw inspect text to `docs/data/raw/`; all property
extraction then happens in `automation/ruby/processor.rb` (Process job).

### Environment Setup
The automation system requires these GitHub Secrets:
- `SIMU_USERNAME`: GemStone IV account username
- `SIMU_PASSWORD`: GemStone IV account password
- `SIMU_CHARACTER`: Character name for scanning

## Development

### Local Development
```bash
# Fetch the current data from the live site (docs/data/ is gitignored)
automation/bin/fetch-site-data

# Start local web server
cd docs
python3 -m http.server 8000   # then open http://localhost:8000

# Test automation components
./automation/bin/setup-environment
./automation/bin/run-scan
```

### Testing Automation
```bash
# Setup local environment (requires credentials)
export SIMU_USERNAME="your-username"
export SIMU_PASSWORD="your-password"
export SIMU_CHARACTER="your-character"

# Run automation locally
./automation/bin/setup-environment
./automation/bin/run-scan
```

## Data Structure

### Town Data
```json
{
  "town": "Wehnimer's Landing",
  "created_at": "2024-09-20T15:30:00Z",
  "shops": [
    {
      "id": "12345",
      "preamble": "Shop location description",
      "inv": [
        {
          "room_title": "Room Name",
          "items": [
            {
              "id": "67890",
              "name": "item name",
              "details": {
                "raw": ["inspection text..."],
                "cost": 1000,
                "tags": ["scripted"],
                "item_type": "weapon"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Removed Items
```json
{
  "town_name": [
    {
      "id": "67890",
      "name": "item name",
      "removed_date": "2024-09-20T15:30:00Z",
      "last_seen_shop": "Shop Name",
      "town": "Town Name"
    }
  ]
}
```

## Performance

### Scan Efficiency
- **Smart Mode**: 2-3 minute runtime (90% cache hit rate)
- **Full Mode**: 65 minute runtime (comprehensive coverage)
- **Data Processing**: JSON generated per run and deployed to GitHub Pages

### Web Performance
- **Static Assets**: Served via GitHub Pages CDN
- **Data Loading**: Town files load in parallel at startup (with a per-town progress count); the added/removed tracking files load only when those tabs are first opened
- **Search**: Client-side filtering for instant results
- **Mobile**: Optimized for all device sizes

## Contributing

### Reporting Issues
1. Check existing issues first
2. Provide detailed reproduction steps
3. Include relevant logs if automation-related

### Pull Requests
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit pull request with clear description

### Automation Changes
- Test locally before submitting
- Ensure backward compatibility
- Update documentation as needed

## Security

- Credentials stored as GitHub Secrets (never in code)
- Authentication files generated dynamically
- Logs automatically scrub sensitive information
- Repository access controlled via GitHub permissions

## Architecture Benefits

### Unified Development
- Single repository for all components
- Consistent version control
- Simplified contribution process
- Coherent script management

### Ruby Excellence
- Clean module structure (inspired by original author)
- Proper separation of concerns
- Enhanced error handling
- Performance optimizations

### Modern DevOps
- GitHub-native automation
- Comprehensive logging
- Artifact retention
- Automated deployment

## Acknowledgments

- **Ondreian**: Original author of bodega.lic and the entire framework, including clean Ruby architecture patterns and Lich integration
- **Community**: Data contributions and feedback
- **GemStone IV**: Game world and shop system

## License

This project is for educational and automation purposes. Please ensure compliance with game policies when using automation tools.

---

**Built with ❤️ for the GemStone IV Community** 
