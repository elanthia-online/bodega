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

            // Load the separate added_items.json if it exists
            const addedItemsData = await this.loadAddedItems();

            // Load shop mapping data if it exists
            await this.loadShopMapping();

            this.processAllData(townDataArray, removedItemsData, addedItemsData);
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

    async loadAddedItems() {
        try {
            console.log('Loading added_items.json...');
            const response = await fetch('data/added_items.json');

            if (!response.ok) {
                console.log('No added_items.json found, will use embedded added_date fields');
                return null;
            }

            const data = await response.json();
            console.log('Loaded added_items.json with', Object.keys(data).length, 'items');
            return data;

        } catch (error) {
            console.log('No added_items.json found, will use embedded added_date fields');
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

    processAllData(townDataArray, removedItemsData, addedItemsData) {
        this.allItems = [];
        this.removedItems = [];
        this.addedItems = [];
        this.towns = [];
        this.totalShops = 0;
        let oldestUpdate = null;

        townDataArray.forEach(townData => {
            if (!townData) return;

            // Clean up town name (remove trailing comma if present)
            const cleanTownName = townData.town.replace(/,\s*$/, '');
            this.towns.push(cleanTownName);
            this.totalShops += townData.shops.length;

            // Track oldest update time
            if (townData.created_at) {
                // Convert "2025-10-06 00:50:25 UTC" to ISO 8601 format for Safari compatibility
                const isoDate = townData.created_at.replace(' UTC', 'Z').replace(' ', 'T');
                const updateTime = new Date(isoDate);

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

                            // Check if item was added using added_items.json
                            // Support both hash-based (new) and ID-based (backwards compatibility) lookups
                            if (addedItemsData) {
                                let itemAddedDate = null;

                                // Try hash-based lookup first (new format)
                                const itemSignature = this.createItemSignature(
                                    townData.town,
                                    shop.preamble,
                                    item.name,
                                    processedItem.price
                                );

                                if (itemSignature && addedItemsData[itemSignature]) {
                                    itemAddedDate = addedItemsData[itemSignature];
                                }

                                // Fall back to ID-based lookup for backwards compatibility
                                if (!itemAddedDate && item.id) {
                                    const itemId = item.id.toString();
                                    if (addedItemsData[itemId]) {
                                        itemAddedDate = addedItemsData[itemId];
                                    }
                                }

                                // If we found a date (from either method), add to addedItems
                                if (itemAddedDate) {
                                    const addedItem = Object.assign({}, processedItem);
                                    addedItem.addedDate = itemAddedDate;
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

                            // Also check if this removed item was in added_items.json
                            if (addedItemsData && removedItem.id) {
                                const itemId = removedItem.id.toString();
                                if (addedItemsData[itemId]) {
                                    const addedItem = Object.assign({}, processedItem);
                                    addedItem.addedDate = addedItemsData[itemId];
                                    this.addedItems.push(addedItem);
                                }
                            }
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
            // All extraction is done by processor.rb - just map fields
            const details = item.details || {};

            return {
                id: item.id,
                name: item.name,
                town: townData.town.replace(/,\s*$/, ''),
                shopId: shop.id,
                shopName: this.extractShopName(shop),
                shopOwner: shop.shop_owner || this.extractShopOwnerName(shop),
                shopLocation: shop.preamble,
                shopSign: this.extractShopSign(shop),
                room: room.room_title,
                roomSign: this.extractRoomSign(room),
                branch: room.branch,

                // Price, enchant, and quantity
                price: details.cost ? parseInt(details.cost) : null,
                enchant: details.enchant || null,
                quantity: item.quantity || null,

                // Materials and properties
                material: details.material || null,
                weight: details.weight || null,
                skill: details.skill || null,
                flare: details.flare || null,

                // Enhancives
                enhancives: details.enhancives || [],

                // Tags and properties
                tags: details.tags || [],

                // Gemstone properties
                gemstoneProperties: details.gemstone_properties || [],
                gemstoneBoundTo: details.gemstone_bound_to || null,

                // Raw text for searching
                raw: details.raw || [],

                // All properties from processor.rb
                capacityLevel: details.capacity_level || null,
                armorType: details.armor_type || null,
                weaponType: details.weapon_type || null,
                shieldType: details.shield_type || null,
                wearLocation: details.worn || details.wear_location || null,
                isWeapon: details.is_weapon || false,
                isArmor: details.is_armor || false,
                isShield: details.is_shield || false,
                isContainer: details.is_container || false,
                isJewelry: details.is_jewelry || false,
                isGemstone: details.is_gemstone || false,
                forgedQuality: details.forged_quality || null,
                forgedAvd: details.forged_avd || null,
                forgedBy: details.forged_by || null,
                itemType: details.item_type || null,
                flares: details.flares || [],
                charges: details.charges || null,
                spell: details.spell || null,
                blessing: details.blessing || null,
                activator: details.activator || null,

                // Combat modifiers
                td_bonus: details.td_bonus || null,
                db_bonus: details.db_bonus || null,
                sanctify: details.sanctify || null,
                ensorcell: details.ensorcell || null,
                sighting: details.sighting || null,

                // Padding (armor)
                dmg_padding: details.dmg_padding || null,
                crit_padding: details.crit_padding || null,
                temporary_dmg_padding: details.temporary_dmg_padding || false,
                temporary_crit_padding: details.temporary_crit_padding || false,

                // Weighting (weapons)
                dmg_weighting: details.dmg_weighting || null,
                crit_weighting: details.crit_weighting || null,
                temporary_dmg_weighting: details.temporary_dmg_weighting || false,
                temporary_crit_weighting: details.temporary_crit_weighting || false,

                // Search text (for fast filtering)
                searchText: this.buildSearchText(item, shop, room, townData)
            };

        } catch (error) {
            console.warn('Error processing item:', item.name, error);
            return null;
        }
    }

    extractShopName(shop) {
        // Use the first room's title as the shop name
        if (!shop.inv || shop.inv.length === 0) return 'Unknown Shop';

        const entryRoom = shop.inv[0]; // First room is usually the entry
        return entryRoom.room_title || 'Unknown Shop';
    }

    extractShopOwnerName(shop) {
        // Extract just the owner name from shop data for shop_mapping lookups
        // shop_mapping.json uses owner names (e.g., "Painz") not full shop names (e.g., "Painz's Magic Shoppe")

        // Try preamble first (most reliable)
        if (shop.preamble) {
            const ownerFromPreamble = this.extractShopNameFromPreamble(shop.preamble);
            if (ownerFromPreamble && ownerFromPreamble !== 'unknown') {
                return ownerFromPreamble;
            }
        }

        // Fall back to extracting from room_title
        const roomTitle = this.extractShopName(shop);
        if (!roomTitle || roomTitle === 'Unknown Shop') return 'unknown';

        // Extract owner name from patterns like:
        //   "Painz's Magic Shoppe" -> "Painz"
        //   "Dark Tower Imports" -> "Dark Tower Imports" (business name, keep as-is)
        const match = roomTitle.match(/^(.*?)'s?\s+(Magic Shoppe|Weaponry|Armory|Outfitting|General Store|Combat Gear|Locksmith Shop|Shop|Boutique)/i);
        if (match) {
            return match[1].trim();
        }

        // Check for possessive without shop type
        const possessiveMatch = roomTitle.match(/^(.*?)'s\s+(.*)$/i);
        if (possessiveMatch) {
            return possessiveMatch[1].trim();
        }

        // Return as-is if no pattern matches (business names)
        return roomTitle;
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
            shop.shop_owner || this.extractShopOwnerName(shop) || '',  // Shop owner for searching by owner name
            this.extractShopSign(shop) || '',
            room.room_title || '',
            ...(item.details?.raw || []),
            ...(item.details?.tags || []),
            item.details?.material || '',
            // Index enhancives in multiple formats for better searchability
            ...(item.details?.enhancives || []).flatMap(e => [
                `${e.boost} to ${e.ability}`,  // "9 to Armor Use Bonus"
                `${e.boost} ${e.ability}`,      // "9 Armor Use Bonus"
                `${e.ability} ${e.boost}`       // "Armor Use Bonus 9"
            ]),
            ...(item.details?.gemstone_properties || []).map(p => `${p.name} ${p.rarity} ${p.mnemonic} ${p.description}`)
        ];

        return parts.join(' ').toLowerCase();
    }

    createItemSignature(town, shopPreamble, itemName, price) {
        // Create item signature matching Ruby's safe_string logic
        // This must match the format in bodega.lic Utils.create_item_signature
        // Using shop_name (extracted from preamble) because shop_id changes during server reboots
        const safeTown = this.safeString(town);
        const safeShop = this.safeString(this.extractShopNameFromPreamble(shopPreamble));
        const safeItem = (itemName || '').toLowerCase().trim();
        const safePrice = (price || 0).toString();

        return `${safeTown}:${safeShop}:${safeItem}:${safePrice}`;
    }

    safeString(text) {
        // Match Ruby's safe_string function
        return (text || '')
            .toString()
            .toLowerCase()
            .replace(/ta'/g, 'ta_')
            .replace(/['",]/g, '')
            .replace(/[-\s]/g, '_');
    }

    extractShopNameFromPreamble(preamble) {
        // Extract shop name from preamble like "Starsworn's Shop is located in..."
        if (!preamble) return 'unknown';
        const match = preamble.match(/^(.*?)'s?\s+Shop\s+is\s+located/i) ||
                     preamble.match(/^(.*?)\s+is\s+located/i);
        return match ? match[1].trim() : 'unknown';
    }

    updateStats() {
        document.getElementById('item-count').textContent = this.allItems.length.toLocaleString();
        document.getElementById('shop-count').textContent = this.totalShops.toLocaleString();
        document.getElementById('town-count').textContent = this.towns.length;

        if (this.lastUpdated) {
            document.getElementById('last-updated').textContent =
                this.lastUpdated.toLocaleDateString() + ' ' + this.lastUpdated.toLocaleTimeString();
        }
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