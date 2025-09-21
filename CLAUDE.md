# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a consolidated repository for GemStone IV Bodega (player shop browser) that combines:
- **Web Application**: Static site served via GitHub Pages at `docs/` directory
- **Ruby Automation System**: Automated data collection using Lich (GemStone IV Ruby framework)
- **CI/CD Pipeline**: GitHub Actions for automated scanning and deployment

## Development Commands

### Local Web Development
```bash
# Start local web server for testing UI
cd docs
python -m http.server 8000
```

### Automation Testing (requires credentials)
```bash
# Setup environment variables first
export SIMU_USERNAME="your-username"
export SIMU_PASSWORD="your-password"
export SIMU_CHARACTER="your-character"

# Setup local environment
./automation/bin/setup-environment

# Run local scan
./automation/bin/run-scan
```

### Key Scripts
- `automation/bin/setup-environment` - Creates authentication files and installs Ruby gems
- `automation/bin/run-scan` - Executes the data collection automation
- `automation/bin/deploy-results` - Processes and commits scan results
- `scripts/bodega.lic` - Core Ruby automation script (single source of truth)

## Architecture

### Web Application (`docs/`)
- **Frontend**: Vanilla JavaScript with modular design
- **Components**: `search.js`, `browse.js`, `added.js`, `removed.js`, `data-loader.js`
- **Styling**: Responsive CSS in `style.css`
- **API Functions**: Netlify serverless functions in `docs/netlify/`

### Data Layer (`docs/data/`)
- **Town Data**: JSON files per town (`wehnimers_landing.json`, `solhaven.json`, etc.)
- **Removed Items**: Centralized tracking in `removed_items.json`
- **Metadata**: `last_updated.txt`, `shop_mapping.json`

### Automation System (`automation/`)
- **Lich Framework**: Ruby environment in `automation/lich/`
- **Ruby Scripts**: Enhanced automation with proper module structure
- **Scan Types**: Smart scans (2-3 min) vs Full scans (65 min at 8 AM UTC)
- **Logging**: Comprehensive logs in `automation/logs/`

### CI/CD (`.github/workflows/`)
- **automation.yml**: Runs every 2 hours, executes data collection
- **deploy.yml**: Deploys web application to GitHub Pages
- **api-upload-processor.yml**: Handles manual data uploads

## Important Code Patterns

### Ruby Automation
The automation follows clean module patterns:
```ruby
# Time-based scan selection
if current_hour == 8
  Bodega::Parser.smart_scan()  # Smart pass first
  Bodega::Parser.full_scan()   # Then full pass
else
  Bodega::Parser.smart_scan()  # Smart only
end
```

### Data Structure
Town data follows consistent JSON schema with shops containing rooms with items. Items include `added_date` for tracking and detailed metadata.

### Error Handling
- Ruby automation includes comprehensive logging and cleanup procedures
- Web application handles missing data gracefully with progress indicators
- GitHub Actions include artifact retention and timeout handling

## Security Considerations
- Credentials stored as GitHub Secrets (never in code)
- Authentication files generated dynamically at runtime
- Logs automatically scrub sensitive information
- Repository access controlled via GitHub permissions

## Development Notes
- No package.json or traditional build system - this is a static site with Ruby automation
- Web assets are served directly from GitHub Pages
- Ruby dependencies managed via gem install in setup scripts
- All paths assume repository root as working directory