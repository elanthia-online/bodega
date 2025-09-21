// Data Loading and Caching System
class DataLoader {
    constructor() {
        this.allItems = [];
        this.removedItems = [];
        this.addedItems = [];
        this.towns = [];
        this.totalShops = 0;
        this.lastUpdated = null;
        this.isLoading = false;
        this.shopMapping = {};  // Store shop name to map ID mapping

        // List of JSON files to load
        this.dataFiles = [
            'data/icemule_trace.json',
            'data/mist_harbor.json',
            'data/rivers_rest.json',
            'data/solhaven.json',
            'data/ta_illistim.json',
            'data/ta_vaalor.json',
            'data/teras_isle.json',
            'data/wehnimers_landing.json',
            'data/zul_logoth.json'
        ];
    }

    async loadAllData() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading(true);

        try {
            console.log('Starting data load...');

            // Load town data files in parallel
            const loadPromises = this.dataFiles.map(file => this.loadTownData(file));
            const townDataArray = await Promise.all(loadPromises);

            // Also load the separate removed_items.json if it exists
            const removedItemsData = await this.loadRemovedItems();

            // Load shop mapping data if it exists
            await this.loadShopMapping();

            this.processAllData(townDataArray, removedItemsData);
            this.updateStats();
            this.populateTownFilter();

            console.log(`Loaded ${this.allItems.length} items, ${this.removedItems.length} removed items, and ${this.addedItems.length} added items from ${this.towns.length} towns`);

        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load shop data. Please try refreshing the page.');
        } finally {
            this.showLoading(false);
            this.isLoading = false;
        }
    }

    async loadTownData(filename) {
        try {
            console.log(`Loading ${filename}...`);
            const response = await fetch(filename);
            // Add specific check for relative path issues
            if (response.status === 404 && filename.startsWith("../")) {
                console.error(`Data file not accessible: ${filename}. This might be a path configuration issue.`);
                throw new Error(`Data file not accessible at ${filename} - check repository structure`);
            }

            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.warn(`Failed to load ${filename}:`, error);
            return null;
        }
    }

    async loadRemovedItems() {
        try {
            console.log('Loading removed_items.json...');
            const response = await fetch('data/removed_items.json');

            if (!response.ok) {
                console.log('No separate removed_items.json found, using embedded data');
                return null;
            }

            const data = await response.json();
            console.log('Loaded separate removed_items.json');
            return data;

        } catch (error) {
            console.log('No separate removed_items.json found, using embedded data');
            return null;
        }
    }

    async loadShopMapping() {
        try {
            console.log('Loading shop mapping data...');
            const response = await fetch('data/shop_mapping.json');

            if (!response.ok) {
                console.log('No shop mapping data found');
                return null;
            }

            const data = await response.json();
            this.shopMapping = data.shops || data;  // Handle both formats
            console.log(`Loaded shop mapping with ${Object.keys(this.shopMapping).length} entries`);
            return data;

        } catch (error) {
            console.log('Failed to load shop mapping:', error);
            return null;
        }
    }

    processAllData(townDataArray, removedItemsData) {
        this.allItems = [];
        this.removedItems = [];
        this.addedItems = [];
        this.towns = [];
        this.townTimestamps = {};
        this.totalShops = 0;
        let oldestUpdate = null;

        townDataArray.forEach(townData => {
            if (!townData) return;

            // Clean up town name (remove trailing comma if present)
            const cleanTownName = townData.town.replace(/,\s*$/, '');
            this.towns.push(cleanTownName);
            this.totalShops += townData.shops.length;

            // Track per-town update time
            if (townData.created_at) {
                const updateTime = new Date(townData.created_at);
                this.townTimestamps[townData.town] = updateTime;

                if (!oldestUpdate || updateTime < oldestUpdate) {
                    oldestUpdate = updateTime;
                }
            }

            // Process each shop
            townData.shops.forEach(shop => {
                shop.inv.forEach(room => {
                    room.items.forEach(item => {
                        const processedItem = this.processItem(item, shop, room, townData);
                        if (processedItem) {
                            this.allItems.push(processedItem);

                            // Check if item was added recently (within last 7 days for data collection)
                            if (item.added_date) {
                                const addedDate = new Date(item.added_date);
                                const sevenDaysAgo = new Date();
                                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                                if (addedDate >= sevenDaysAgo) {
                                    const addedItem = Object.assign({}, processedItem);
                                    addedItem.addedDate = item.added_date;
                                    this.addedItems.push(addedItem);
                                }
                            }
                        }
                    });
                });
            });

            // Process removed items from embedded data (for backward compatibility)
            // Only use embedded data if we don't have separate removed_items.json
            if (!removedItemsData && townData.removed_items && Array.isArray(townData.removed_items)) {
                townData.removed_items.forEach(removedItem => {
                    const processedItem = this.processItem(removedItem, {}, {}, townData);
                    if (processedItem) {
                        // Add removal metadata
                        processedItem.removedDate = removedItem.removed_date || new Date().toISOString();
                        processedItem.lastSeenShop = removedItem.last_seen_shop || null;
                        processedItem.lastSeenTown = cleanTownName;

                        this.removedItems.push(processedItem);
                    }
                });
            }
        });

        // Process removed items from separate file if available
        if (removedItemsData) {
            console.log('Processing removed items from separate file...');
            Object.keys(removedItemsData).forEach(townName => {
                const cleanTownName = townName.replace(/,\s*$/, '');
                const removedItems = removedItemsData[townName];

                if (Array.isArray(removedItems)) {
                    removedItems.forEach(removedItem => {
                        // Create minimal townData for processing
                        const fakeTownData = { town: cleanTownName };
                        const processedItem = this.processItem(removedItem, {}, {}, fakeTownData);

                        if (processedItem) {
                            // Add removal metadata
                            processedItem.removedDate = removedItem.removed_date || removedItem.removedDate || new Date().toISOString();
                            processedItem.lastSeenShop = removedItem.last_seen_shop || removedItem.lastSeenShop || null;
                            processedItem.lastSeenTown = removedItem.town || cleanTownName;

                            this.removedItems.push(processedItem);
                        }
                    });
                }
            });
        }

        // No filtering by date - let the backend handle retention policy
        // The backend now manages cleanup based on size/date constraints

        this.lastUpdated = oldestUpdate;
    }

    processItem(item, shop, room, townData) {
        try {
            // Extract price from multiple possible sources
            let price = null;
            if (item.details?.cost) {
                price = parseInt(item.details.cost);
            } else if (item.details?.raw) {
                const priceLine = item.details.raw.find(line =>
                    line.includes('will cost') && line.includes('coins')
                );
                if (priceLine) {
                    const match = priceLine.match(/will cost ([\d,]+) coins/);
                    if (match) {
                        price = parseInt(match[1].replace(/,/g, ''));
                    }
                }
            }

            // Parse advanced properties from raw text
            const advancedProps = this.parseAdvancedProperties(item);

            // Build enhanced item object
            return {
                id: item.id,
                name: item.name,
                town: townData.town.replace(/,\s*$/, ''),
                shopId: shop.id,
                shopName: this.extractShopName(shop),
                shopLocation: shop.preamble,
                shopSign: this.extractShopSign(shop),
                room: room.room_title,
                roomSign: this.extractRoomSign(room),
                branch: room.branch,

                // Price and enchant
                price: price,
                enchant: item.details?.enchant || null,

                // Materials and properties
                material: item.details?.material || null,
                weight: item.details?.weight || null,

                // Enhancives
                enhancives: item.details?.enhancives || [],

                // Tags and properties
                tags: item.details?.tags || [],

                // Gemstone properties (handle both old and new field names)
                gemstoneProperties: item.details?.gemstone_properties || item.details?.jewel_properties || [],
                gemstoneBoundTo: item.details?.gemstone_bound_to || item.details?.jewel_bound_to || null,

                // Raw text for searching
                raw: item.details?.raw || [],

                // Advanced parsed properties
                ...advancedProps,

                // Use worn field from bodega.lic if available
                wearLocation: item.details?.worn || advancedProps.wearLocation,

                // Search text (for fast filtering)
                searchText: this.buildSearchText(item, shop, room, townData)
            };

        } catch (error) {
            console.warn('Error processing item:', item.name, error);
            return null;
        }
    }

    parseAdvancedProperties(item) {
        const properties = {
            capacity: null,
            capacityLevel: null,
            armorType: null,
            weaponType: null,
            shieldType: null,
            itemType: null,
            wearLocation: null,
            flares: [],
            isWeapon: false,
            isArmor: false,
            isShield: false,
            isContainer: false,
            isJewelry: false,
            charges: null,
            spell: null,
            blessing: null
        };

        (item.details?.raw || []).forEach(line => {
            // Capacity parsing
            const capacityMatch = line.match(/can store a (.*?) amount/i);
            if (capacityMatch) {
                properties.capacity = line.trim();
                properties.capacityLevel = capacityMatch[1].toLowerCase();
                properties.isContainer = true;
            }

            // Armor type parsing - improved to catch robes and other armor
            const armorMatch = line.match(/is (.*?) armor that/i) ||
                             line.match(/The .* is (.*?) armor/i) ||
                             line.match(/covers.*torso/i) ||
                             line.match(/covers.*chest/i) ||
                             line.match(/covers.*body/i) ||
                             line.match(/protects.*body/i) ||
                             line.match(/armor.*covers/i) ||
                             line.match(/robe.*covers/i) ||
                             line.match(/robes.*cover/i);
            if (armorMatch) {
                properties.armorType = armorMatch[1] ? armorMatch[1].toLowerCase() : 'armor';
                properties.isArmor = true;
            }

            // No need to parse skill from raw - it's already in the data

            // Shield specific parsing
            if (line.match(/shield that protects/i) || line.match(/is a.*shield/i)) {
                properties.isShield = true;
                const shieldMatch = line.match(/is a (.*?) shield/i);
                if (shieldMatch) {
                    properties.shieldType = shieldMatch[1].toLowerCase();
                }
            }

            // Wear location parsing based on GemStone messaging patterns
            const wearPatterns = [
                // Armor coverage
                { pattern: /covers the (.*?)[\.,]/i, location: '$1' },
                { pattern: /worn (.*?)[\.,]/i, location: '$1' },
                { pattern: /around the (.*?)[\.,]/i, location: '$1' },
                { pattern: /over the (.*?)[\.,]/i, location: '$1' },

                // Specific GS messaging patterns
                { pattern: /put on.*as a (helm|hat|cap|crown)/i, location: 'head' },
                { pattern: /put on.*as (boots|shoes|sandals)/i, location: 'feet' },
                { pattern: /put on.*as (gloves|gauntlets)/i, location: 'hands' },
                { pattern: /put on.*as a (belt)/i, location: 'waist' },
                { pattern: /hung around.*as (necklace|pendant)/i, location: 'neck' },
                { pattern: /slid onto.*as a (ring)/i, location: 'finger' },
                { pattern: /attached to.*as a (bracelet)/i, location: 'wrist' },
                { pattern: /attached to.*as an (anklet)/i, location: 'ankle' },
                { pattern: /hung from.*as.*earring/i, location: 'earlobe' },
                { pattern: /draped from.*as a (cloak|cape)/i, location: 'shoulders' },
                { pattern: /slung over.*as a (shield)/i, location: 'shoulder' },
                { pattern: /worked into.*as (armor)/i, location: 'torso' },
                { pattern: /put over.*as an (apron)/i, location: 'front' },
                { pattern: /put in.*as.*barrette/i, location: 'hair' },
                { pattern: /attached to.*as.*pouch/i, location: 'belt' }
            ];

            for (const wp of wearPatterns) {
                const match = line.match(wp.pattern);
                if (match) {
                    properties.wearLocation = wp.location.replace('$1', match[1]?.trim());
                    break;
                }
            }

            // Flare parsing
            if (line.match(/infused.*power/i) ||
                line.match(/flare/i) ||
                line.match(/holy.*fire/i) ||
                line.match(/blessed.*undead/i)) {
                properties.flares.push(line.trim());
            }

            // Spell parsing
            const spellMatch = line.match(/imbedded with the (.*?) spell/i);
            if (spellMatch) {
                properties.spell = spellMatch[1];
            }

            // Charges parsing
            const chargesMatch = line.match(/(\d+) charges? remaining/i) ||
                               line.match(/looks to have (.*?) charges/i);
            if (chargesMatch) {
                properties.charges = chargesMatch[1];
            }

            // Item type detection - be more specific
            if (line.match(/is.*jewelry/i) ||
                line.match(/\b(ring|necklace|bracelet|earring|pendant|amulet|brooch|pin)\b/i)) {
                properties.isJewelry = true;
                properties.itemType = 'jewelry';
            }

            // Container detection - only if it has storage capacity
            if (line.match(/can store.*amount/i) ||
                line.match(/container.*capacity/i) ||
                line.match(/holds.*amount/i) ||
                line.match(/storage.*capacity/i)) {
                properties.isContainer = true;
                properties.itemType = 'container';
            }

            // Additional container detection by name - but only if not already identified as armor/weapon
            if (!properties.isWeapon && !properties.isArmor && !properties.isShield &&
                line.match(/\b(bag|sack|backpack|pouch|satchel|chest|strongbox|trunk|basket|belt|sheath|scabbard|harness|bandolier)\b/i) &&
                !line.match(/robe|armor|mail|scale|chain|plate|leather|hide|skin/i)) {
                properties.isContainer = true;
                properties.itemType = 'container';
            }

            // Blessing detection
            if (line.match(/blessed/i) || line.match(/holy/i)) {
                properties.blessing = 'holy';
            }
        });

        // Use existing skill field to determine weapons
        if (item.details?.skill) {
            properties.skill = item.details.skill.toLowerCase();
            // Only items with weapon skills are weapons (expanded list)
            const weaponSkills = [
                'edged weapons', 'blunt weapons', 'two handed weapons', 'twohanded weapons',
                'polearms', 'ranged weapons', 'thrown weapons', 'brawling'
            ];
            if (weaponSkills.includes(properties.skill)) {
                properties.isWeapon = true;
                properties.weaponType = properties.skill;
            }
        }

        // Also check for shield use and armor use skills
        if (item.details?.skill) {
            const skill = item.details.skill.toLowerCase();
            if (skill === 'shield use') {
                properties.isShield = true;
                properties.shieldType = 'shield';
            }
            if (skill === 'armor use') {
                properties.isArmor = true;
                properties.armorType = 'armor';
            }
        }

        // Determine primary item type with proper priority
        if (!properties.itemType) {
            // Priority order: Weapon > Armor > Shield > Container > Jewelry > Misc
            // Weapons and armor should take precedence over container classification
            if (properties.isWeapon) properties.itemType = 'weapon';
            else if (properties.isArmor) properties.itemType = 'armor';
            else if (properties.isShield) properties.itemType = 'shield';
            else if (properties.isContainer) properties.itemType = 'container';
            else if (properties.isJewelry) properties.itemType = 'jewelry';
            // No default itemType assignment
        }

        return properties;
    }

    extractShopName(shop) {
        // Use the first room's title as the shop name
        if (!shop.inv || shop.inv.length === 0) return 'Unknown Shop';

        const entryRoom = shop.inv[0]; // First room is usually the entry
        return entryRoom.room_title || 'Unknown Shop';
    }

    extractShopSign(shop) {
        // Look for shop sign in the first room (entry room)
        if (!shop.inv || shop.inv.length === 0) return '';

        const entryRoom = shop.inv[0]; // First room is usually the entry
        if (entryRoom.sign && entryRoom.sign.length > 0) {
            // Filter out the "Written on..." line and join the rest
            return entryRoom.sign
                .filter(line => !line.match(/^Written on/))
                .join(' ')
                .trim();
        }

        return '';
    }

    extractRoomSign(room) {
        // Extract sign from this specific room
        if (room.sign && room.sign.length > 0) {
            // Filter out the "Written on..." line and join the rest
            return room.sign
                .filter(line => !line.match(/^Written on/))
                .join(' ')
                .trim();
        }

        return '';
    }

    buildSearchText(item, shop, room, townData) {
        const parts = [
            item.name,
            townData.town,
            shop.preamble || '',
            this.extractShopSign(shop) || '',
            room.room_title || '',
            ...(item.details?.raw || []),
            ...(item.details?.tags || []),
            item.details?.material || '',
            ...(item.details?.enhancives || []).map(e => `${e.ability} ${e.boost}`),
            ...(item.details?.gemstone_properties || []).map(p => `${p.name} ${p.rarity} ${p.mnemonic} ${p.description}`)
        ];

        return parts.join(' ').toLowerCase();
    }

    updateStats() {
        document.getElementById('item-count').textContent = this.allItems.length.toLocaleString();
        document.getElementById('shop-count').textContent = this.totalShops.toLocaleString();
        document.getElementById('town-count').textContent = this.towns.length;

        if (this.lastUpdated) {
            document.getElementById('last-updated').textContent =
                this.lastUpdated.toLocaleDateString() + ' ' + this.lastUpdated.toLocaleTimeString();
        }

        // Add detailed town timestamp info
        this.updateTownTimestamps();
    }

    updateTownTimestamps() {
        const timestampContainer = document.getElementById('town-timestamps') || this.createTimestampContainer();

        // Sort towns by most recent update
        const sortedTowns = Object.keys(this.townTimestamps)
            .sort((a, b) => this.townTimestamps[b] - this.townTimestamps[a]);

        if (sortedTowns.length === 0) {
            timestampContainer.innerHTML = '<div class="ticker-content">No town data available</div>';
            return;
        }

        // Build ticker content - duplicate for seamless scrolling
        const tickerItems = sortedTowns.map(town => {
            const timestamp = this.townTimestamps[town];
            const timeAgo = this.getTimeAgo(timestamp);
            return `<span class="ticker-item"><strong>${town}:</strong> ${timeAgo}</span>`;
        }).join('');

        // Create ticker with duplicated content for seamless loop
        // Add spacer between duplicates for better visual separation
        timestampContainer.innerHTML = `
            <div class="ticker-wrapper">
                <div class="ticker-label">Town Updates:</div>
                <div class="ticker-scroll-wrapper">
                    <div class="ticker-content">
                        ${tickerItems}
                        <span class="ticker-item ticker-spacer"></span>
                        ${tickerItems}
                    </div>
                </div>
            </div>
        `;
    }

    createTimestampContainer() {
        const container = document.createElement('div');
        container.id = 'town-timestamps';
        container.className = 'town-timestamps-ticker';

        // Insert after the main stats
        const stats = document.getElementById('stats');
        stats.parentNode.insertBefore(container, stats.nextSibling);

        return container;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    populateTownFilter() {
        const townFilter = document.getElementById('town-filter');
        const uniqueTowns = [...new Set(this.towns)].sort();

        // Clear existing options except the placeholder
        while (townFilter.children.length > 1) {
            townFilter.removeChild(townFilter.lastChild);
        }

        uniqueTowns.forEach(town => {
            const option = document.createElement('option');
            option.value = town;
            option.textContent = town;
            townFilter.appendChild(option);
        });
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        const content = document.getElementById('content');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        content.insertBefore(errorDiv, content.firstChild);
    }

    // Utility methods for other components
    getAllItems() {
        return this.allItems;
    }

    getTowns() {
        return [...new Set(this.towns)].sort();
    }

    getItemById(id) {
        return this.allItems.find(item => item.id === id);
    }

    // Price formatting utility
    static formatPrice(price) {
        if (!price || price === 0) return 'Free';

        if (price >= 1000000) {
            return (price / 1000000).toFixed(1) + 'M';
        } else if (price >= 1000) {
            return (price / 1000).toFixed(0) + 'k';
        }
        return price.toLocaleString();
    }

    // Get price range for filtering
    static getPriceRange(rangeString) {
        if (!rangeString) return { min: 0, max: Infinity };

        const [min, max] = rangeString.split('-').map(Number);
        return { min: min || 0, max: max || Infinity };
    }
}

// Global data loader instance
window.dataLoader = new DataLoader();

// Add backward compatibility method
window.dataLoader.getAllItems = function() {
    return this.allItems;
};

// Auto-load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Starting data load...');
    await window.dataLoader.loadAllData();
    console.log('Data loading complete, dispatching dataLoaded event');
    console.log('Total items loaded:', window.dataLoader.allItems.length);
    // Notify search.js that data is loaded
    window.dispatchEvent(new CustomEvent('dataLoaded'));
});