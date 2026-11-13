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
        this.ownerLocationIndex = {};  // owner name -> {roomName, roomNumber, exterior} from town data
        this.rawShopData = {};  // Store raw shop structure for all towns (includes empty rooms)
        this.embeddedRemovedItems = [];  // legacy removed_items embedded in town files

        // Resolves once the town files are processed. The Added/Removed tabs
        // fetch their tracking files on first use and wait on this first.
        this.townsLoaded = new Promise(resolve => { this.resolveTownsLoaded = resolve; });
        this.addedItemsPromise = null;
        this.removedItemsPromise = null;

        // Fallback town files, used only if data/towns.json is unavailable.
        // Towns are normally discovered from the manifest published by
        // processor.rb, so new towns appear without code changes.
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

    async loadTownManifest() {
        try {
            const response = await fetch('data/towns.json', { cache: 'no-cache' });
            if (!response.ok) {
                return this.dataFiles;
            }
            const manifest = await response.json();
            // Display names, used in load-error messages
            this.townNamesByFile = {};
            (manifest.towns || []).forEach(t => {
                if (t.file && t.town) this.townNamesByFile[`data/${t.file}`] = t.town;
            });
            const files = (manifest.towns || [])
                .map(t => t.file)
                .filter(Boolean)
                .map(file => `data/${file}`);
            if (files.length === 0) {
                return this.dataFiles;
            }
            return files;
        } catch (error) {
            return this.dataFiles;
        }
    }

    async loadAllData() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading(true);

        try {
            // Discover towns from the manifest, then load town files in parallel.
            // added_items.json / removed_items.json are NOT loaded here: they
            // are only needed by the Added/Removed tabs, which fetch them on
            // first use (ensureAddedItems / ensureRemovedItems).
            const townFiles = await this.loadTownManifest();
            let loaded = 0;
            this.setLoadingMessage(`Loading shop data… (0 of ${townFiles.length} towns)`);
            const loadPromises = townFiles.map(file => this.loadTownData(file).then(data => {
                loaded++;
                this.setLoadingMessage(`Loading shop data… (${loaded} of ${townFiles.length} towns)`);
                return data;
            }));
            const townDataArray = await Promise.all(loadPromises);

            this.processAllData(townDataArray);
            this.updateStats();
            this.populateTownFilter();

            // loadTownData returns null for a town it couldn't load; say so
            // instead of silently showing fewer (or zero) items
            const failed = townFiles.filter((file, i) => !townDataArray[i]);
            if (failed.length === townFiles.length) {
                this.showError("Couldn't load any shop data. Check your connection and refresh the page.");
            } else if (failed.length > 0) {
                const names = failed.map(file => (this.townNamesByFile && this.townNamesByFile[file]) ||
                    file.replace(/^data\//, '').replace(/\.json$/, '').replace(/_/g, ' '));
                this.showError(`Couldn't load shop data for ${names.join(', ')}. Results from ${failed.length === 1 ? 'that town' : 'those towns'} are missing; refreshing usually fixes this.`);
            }

        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load shop data. Please try refreshing the page.');
        } finally {
            this.showLoading(false);
            this.isLoading = false;
            this.resolveTownsLoaded();
        }
    }

    // Recently added items: town items whose signature is in added_items.json.
    // Fetched once, on first use. A failed fetch rejects and isn't cached, so
    // a retry fetches again.
    ensureAddedItems() {
        if (!this.addedItemsPromise) {
            this.addedItemsPromise = this.townsLoaded
                .then(() => this.loadAddedItems())
                .then(addedItemsData => {
                    if (!addedItemsData) {
                        this.addedItemsPromise = null;
                        throw new Error("Couldn't load added_items.json");
                    }
                    this.addedItems = this.buildAddedItems(addedItemsData);
                    return this.addedItems;
                });
        }
        return this.addedItemsPromise;
    }

    // Removed items from removed_items.json (or, for old data, the copies
    // embedded in town files). Fetched once, on first use.
    ensureRemovedItems() {
        if (!this.removedItemsPromise) {
            this.removedItemsPromise = this.townsLoaded
                .then(() => this.loadRemovedItems())
                .then(removedItemsData => {
                    if (!removedItemsData) this.removedItemsPromise = null;
                    this.removedItems = this.buildRemovedItems(removedItemsData);
                    // Without the file, only old data's embedded copies remain
                    if (!removedItemsData && this.removedItems.length === 0) {
                        throw new Error("Couldn't load removed_items.json");
                    }
                    return this.removedItems;
                });
        }
        return this.removedItemsPromise;
    }

    async loadTownData(filename) {
        try {
            // no-cache: revalidate with the server so we don't serve stale
            // data (town files are regenerated every ~2 hours)
            const response = await fetch(filename, { cache: 'no-cache' });
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
            const response = await fetch('data/removed_items.json', { cache: 'no-cache' });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.warn('Failed to load removed_items.json:', error);
            return null;
        }
    }

    async loadAddedItems() {
        try {
            const response = await fetch('data/added_items.json', { cache: 'no-cache' });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.warn('Failed to load added_items.json:', error);
            return null;
        }
    }

    processAllData(townDataArray) {
        this.allItems = [];
        this.embeddedRemovedItems = [];
        this.towns = [];
        this.totalShops = 0;
        this.ownerLocationIndex = {};
        let oldestUpdate = null;

        townDataArray.forEach(townData => {
            if (!townData) return;

            // Clean up town name (remove trailing comma if present)
            const cleanTownName = townData.town.replace(/,\s*$/, '');
            this.towns.push(cleanTownName);
            this.totalShops += townData.shops.length;

            // Store raw shop data structure (includes empty rooms)
            this.rawShopData[cleanTownName] = townData.shops.map(shop => ({
                id: shop.id,
                preamble: shop.preamble,
                shopOwner: shop.shop_owner,
                shopName: this.extractShopName(shop),
                roomName: shop.room_name || null,
                roomNumber: shop.room_number || null,
                exterior: shop.exterior || null,
                rooms: shop.inv.map(room => ({
                    roomTitle: room.room_title,
                    branch: room.branch,
                    sign: room.sign,
                    itemCount: room.items ? room.items.length : 0
                }))
            }));

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
                // Index shop location by owner name (used for removed items,
                // whose shop may no longer exist in current town data)
                const owner = shop.shop_owner || this.extractShopOwnerName(shop);
                if (owner && owner !== 'unknown' && !this.ownerLocationIndex[owner]) {
                    this.ownerLocationIndex[owner] = {
                        roomName: shop.room_name || null,
                        roomNumber: shop.room_number || null,
                        exterior: shop.exterior || null
                    };
                }

                shop.inv.forEach(room => {
                    room.items.forEach(item => {
                        const processedItem = this.processItem(item, shop, room, townData);
                        if (processedItem) {
                            this.allItems.push(processedItem);
                        }
                    });
                });
            });

            // Legacy: removed items embedded in town files. Only used if
            // removed_items.json is unavailable (see buildRemovedItems).
            if (Array.isArray(townData.removed_items)) {
                townData.removed_items.forEach(removedItem => {
                    this.embeddedRemovedItems.push({ town: cleanTownName, item: removedItem });
                });
            }
        });

        this.lastUpdated = oldestUpdate;
    }

    buildAddedItems(addedItemsData) {
        if (!addedItemsData) return [];
        const addedItems = [];

        this.allItems.forEach(item => {
            // Signature lookup (current format), then legacy item-ID keys
            const signature = this.createItemSignature(item.town, item.shopLocation, item.name);
            let addedDate = addedItemsData[signature];
            if (!addedDate && item.id) {
                addedDate = addedItemsData[item.id.toString()];
            }
            if (addedDate) {
                addedItems.push(Object.assign({}, item, { addedDate }));
            }
        });

        return addedItems;
    }

    buildRemovedItems(removedItemsData) {
        const removedItems = [];
        const addRemoved = (removedItem, townName) => {
            const processedItem = this.processItem(removedItem, {}, {}, { town: townName });
            if (!processedItem) return;
            processedItem.removedDate = removedItem.removed_date || removedItem.removedDate || new Date().toISOString();
            processedItem.lastSeenShop = removedItem.last_seen_shop || removedItem.lastSeenShop || null;
            processedItem.lastSeenTown = removedItem.town || townName;
            removedItems.push(processedItem);
        };

        if (removedItemsData) {
            Object.keys(removedItemsData).forEach(townName => {
                const cleanTownName = townName.replace(/,\s*$/, '');
                const items = removedItemsData[townName];
                if (Array.isArray(items)) {
                    items.forEach(removedItem => addRemoved(removedItem, cleanTownName));
                }
            });
        } else {
            this.embeddedRemovedItems.forEach(({ town, item }) => addRemoved(item, town));
        }

        // No filtering by date - the processor manages the retention policy
        return removedItems;
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
                shopRoomName: shop.room_name || null,
                shopRoomNumber: shop.room_number || null,
                shopExterior: shop.exterior || null,
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
                defender: details.defender || null,
                sanctify: details.sanctify || null,
                ensorcell: details.ensorcell || null,
                sighting: details.sighting || null,
                chrism: details.chrism || false,

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
        // IMPORTANT: Use preamble or shop_owner, NOT room_title
        // room_title can be stale when shop ownership changes (e.g., Faulkil's shop showing as "Kizalia's Armory")

        // Try shop_owner first (most reliable for display)
        if (shop.shop_owner) {
            return `${shop.shop_owner}'s Shop`;
        }

        // Try extracting from preamble
        if (shop.preamble) {
            const ownerMatch = shop.preamble.match(/^(.*?)'s?\s+Shop\s+is\s+located/i);
            if (ownerMatch) {
                return `${ownerMatch[1]}'s Shop`;
            }

            // Handle business names (e.g., "Dark Tower Imports is located...")
            const businessMatch = shop.preamble.match(/^([^,]+?)\s+is\s+located/i);
            if (businessMatch) {
                return businessMatch[1].trim();
            }
        }

        // Fallback to room title (legacy behavior, but can be stale)
        if (shop.inv && shop.inv.length > 0) {
            const entryRoom = shop.inv[0];
            if (entryRoom.room_title) {
                console.warn(`Using potentially stale room_title for shop: ${entryRoom.room_title}`);
                return entryRoom.room_title;
            }
        }

        return 'Unknown Shop';
    }

    extractShopOwnerName(shop) {
        // Extract just the owner name from shop data for ownerLocationIndex lookups
        // The index uses owner names (e.g., "Painz") not full shop names (e.g., "Painz's Magic Shoppe")

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

    createItemSignature(town, shopPreamble, itemName) {
        // Create item signature matching processor.rb create_item_signature.
        // Using shop_name (extracted from preamble) because shop_id changes
        // during server reboots. Price is intentionally excluded so a price
        // change does not make the same item look removed-and-re-added.
        const safeTown = this.safeString(town);
        const safeShop = this.safeString(this.extractShopNameFromPreamble(shopPreamble));
        const safeItem = (itemName || '').toLowerCase().trim();

        return `${safeTown}:${safeShop}:${safeItem}`;
    }

    safeString(text) {
        // Match Ruby's safe_string function (strips ' " and ,)
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

    setLoadingMessage(text) {
        const message = document.getElementById('loading-message');
        if (message) message.textContent = text;
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        const content = document.getElementById('content');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.setAttribute('role', 'alert');
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
        // id may arrive as a string (URL param) while item.id is numeric
        return this.allItems.find(item => String(item.id) === String(id));
    }

    // Escape untrusted text (item/shop/room names are player-controlled)
    // before interpolating into innerHTML templates
    static escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Escape user input before building a RegExp from it
    static escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Price formatting utility. Compact k/M style but preserving precision:
    // up to three decimals with trailing zeros trimmed, so k values are exact
    // to the coin (1,500 -> 1.5k, 1,555 -> 1.555k, 5,000 -> 5k,
    // 2,500,000 -> 2.5M) - never 1,500 -> 2k.
    static formatPrice(price) {
        if (!price || price === 0) return 'Free';

        const compact = (value) => parseFloat(value.toFixed(3)).toString();

        if (price >= 1000000) {
            return compact(price / 1000000) + 'M';
        } else if (price >= 1000) {
            return compact(price / 1000) + 'k';
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
    await window.dataLoader.loadAllData();
    // Notify search.js that data is loaded
    window.dispatchEvent(new CustomEvent('dataLoaded'));
});