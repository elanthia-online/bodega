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
- **Advanced Search**: Full-text search with wildcard support and filters
- **Browse Mode**: Hierarchical navigation through towns → shops → rooms → items
- **Recently Added**: Items added to shops within the last 24 hours
- **Recently Removed**: Items removed from shops with comprehensive tracking
- **Mobile Responsive**: Optimized for all device sizes
- **Direct Linking**: Share specific items via URL

### Automation System
- **Smart Scanning**: 90%+ efficiency improvement via intelligent caching
- **Dual Mode Operation**: Smart scans (2-3 minutes) vs Full scans (65 minutes)
- **Clean Ruby Integration**: Proper module structure inspired by original author
- **Automated Scheduling**: Runs every 2 hours via GitHub Actions
- **Git-Native**: Direct integration with repository for seamless updates

## Architecture

```
```bodega/├── docs/                  # Web Application (GitHub Pages)│   ├── index.html        # Main UI│   ├── *.js             # Feature modules│   ├── style.css        # Responsive styling│   ├── data/            # JSON data files│   │   ├── *.json       # Town shop data│   │   └── removed_items.json # Removed items tracking│   └── netlify/         # API functions├── automation/           # Ruby automation system│   ├── lich/            # Lich environment│   └── bin/             # Automation scripts├── scripts/              # Core scripts│   └── bodega.lic       # Single source of truth├── .github/workflows/    # CI/CD automation│   ├── automation.yml   # Data collection│   ├── deploy.yml       # Web deployment│   └── api-processor.yml # Manual uploads└── README.md            # Documentation```
```

## Quick Start

### For Users
Visit the web interface: [Bodega](https://elanthia-online.github.io/bodega)

### For Contributors
1. Fork this repository
2. Make your changes
3. Submit a pull request

### For Data Collection (Automation)
The repository automatically collects data every 2 hours. Manual uploads are also supported through the web interface.

## Automation System

### Scan Types
- **Smart Scan** (default): Only inspects new/changed items - 90% faster
- **Full Scan** (8 AM UTC): Comprehensive scan of all shops

### Ruby Integration
Based on the original author's clean patterns:

```ruby
# Enhanced headless.lic with proper module integration
Bodega::Opts[:headless] = true
Bodega::Opts[:automation] = true

# Time-based scan selection
if current_hour == 8
  Bodega::Parser.smart_scan()  # Smart pass first
  Bodega::Parser.full_scan()   # Then full pass
else
  Bodega::Parser.smart_scan()  # Smart only
end

Bodega::Parser.to_json()
```

### Environment Setup
The automation system requires these GitHub Secrets:
- `SIMU_USERNAME`: GemStone IV account username
- `SIMU_PASSWORD`: GemStone IV account password
- `SIMU_CHARACTER`: Character name for scanning

## Development

### Local Development
```bash
# Start local web server
cd docs
python -m http.server 8000

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
              "price": 1000,
              "added_date": "2024-09-20T15:30:00Z",
              "details": { ... }
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
- **Data Processing**: Real-time JSON generation and git integration

### Web Performance
- **Static Assets**: Served via GitHub Pages CDN
- **Data Loading**: Asynchronous with progress indicators
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

- **Original Author**: Clean Ruby architecture patterns and Lich integration
- **Community**: Data contributions and feedback
- **GemStone IV**: Game world and shop system

## License

This project is for educational and automation purposes. Please ensure compliance with game policies when using automation tools.

---

**Built with ❤️ for the GemStone IV Community**