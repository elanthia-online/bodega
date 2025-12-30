class BrowseEngine {
    constructor() {
        this.currentTown = null;
        this.currentShop = null;
        this.townData = {};
        this.currentSort = { field: 'name', direction: 'asc' };
        this.sortMode = 'by-room'; // 'by-room' or 'all-items'
        this.initializeEventListeners();
        this.initializeHashNavigation();
    }

    initializeEventListeners() {
        // Tab switching
        document.getElementById('search-tab').addEventListener('click', () => this.switchToSearch());
        document.getElementById('browse-tab').addEventListener('click', () => this.switchToBrowse());

        // Browse navigation
        document.getElementById('browse-town-select').addEventListener('change', (e) => this.selectTown(e.target.value));
        document.getElementById('back-to-shops').addEventListener('click', () => this.backToShops());

        // Shop sign search
        document.getElementById('shop-sign-search-btn').addEventListener('click', () => this.searchShopSigns());
        document.getElementById('shop-sign-clear-btn').addEventListener('click', () => this.clearShopSignSearch());
        document.getElementById('shop-sign-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchShopSigns();
            }
        });

        // Sort mode toggle
        document.getElementById('sort-by-room-btn').addEventListener('click', () => this.setSortMode('by-room'));
        document.getElementById('sort-all-items-btn').addEventListener('click', () => this.setSortMode('all-items'));
    }

    initializeHashNavigation() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleHashChange());
    }

    isActiveMode() {
        const browseMode = document.getElementById('browse-mode');
        return browseMode && browseMode.style.display !== 'none';
    }

    handleHashChange() {
        const hash = window.location.hash;
        if (!hash || hash === '#') return;

        // Parse hash format: #browse/town-name/shop-name
        const match = hash.match(/^#browse\/([^/]+)\/(.+)$/);
        if (match) {
            const townSlug = match[1];
            const shopSlug = match[2];

            // Convert slugs back to original names
            const townName = this.slugToName(townSlug);
            const shopName = this.slugToName(shopSlug);

            console.log(`Hash navigation to: ${townName} / ${shopName}`);

            // Switch to browse mode and select the shop
            this.switchToBrowseAndSelectShop(townName, shopName);
        }
    }

    nameToSlug(name) {
        return name.toLowerCase()
            .replace(/['']/g, '')  // Remove apostrophes
            .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
            .replace(/^-+|-+$/g, '');  // Remove leading/trailing dashes
    }

    slugToName(slug) {
        // We'll need to search through our data to find the matching name
        // This is necessary because we can't perfectly reverse the slug transformation
        const searchSlug = slug.toLowerCase();

        // Search towns
        for (const townName of Object.keys(this.townData)) {
            if (this.nameToSlug(townName) === searchSlug) {
                return townName;
            }

            // Search shops within this town
            for (const shopName of Object.keys(this.townData[townName])) {
                if (this.nameToSlug(shopName) === searchSlug) {
                    return shopName;
                }
            }
        }

        return slug;  // Return original if no match found
    }

    updateUrlHash(townName, shopName) {
        const townSlug = this.nameToSlug(townName);
        const shopSlug = this.nameToSlug(shopName);
        const newHash = `#browse/${townSlug}/${shopSlug}`;

        // Update URL without triggering hashchange event
        if (window.location.hash !== newHash) {
            history.replaceState(null, null, newHash);
        }
    }

    clearUrlHash() {
        if (window.location.hash) {
            history.replaceState(null, null, window.location.pathname);
        }
    }

    setSortMode(mode) {
        this.sortMode = mode;

        // Update button active states
        const byRoomBtn = document.getElementById('sort-by-room-btn');
        const allItemsBtn = document.getElementById('sort-all-items-btn');

        if (mode === 'by-room') {
            byRoomBtn.classList.add('active');
            allItemsBtn.classList.remove('active');
        } else {
            byRoomBtn.classList.remove('active');
            allItemsBtn.classList.add('active');
        }

        // Re-render current shop with new sort mode
        if (this.currentTown && this.currentShop) {
            this.showRoomInventory(this.currentTown, this.currentShop);
        }
    }

    copyShopLink(townName, shopName, event) {
        event.stopPropagation();  // Prevent shop selection when clicking copy button

        const townSlug = this.nameToSlug(townName);
        const shopSlug = this.nameToSlug(shopName);
        const url = `${window.location.origin}${window.location.pathname}#browse/${townSlug}/${shopSlug}`;

        navigator.clipboard.writeText(url).then(() => {
            // Show feedback
            const button = event.target.closest('.copy-link-btn');
            const originalText = button.innerHTML;
            button.innerHTML = '✓ Copied!';
            button.classList.add('copied');

            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy link:', err);
            alert('Failed to copy link. Please copy manually: ' + url);
        });
    }

    switchToSearch() {
        document.getElementById('search-tab').classList.add('active');
        document.getElementById('browse-tab').classList.remove('active');
        document.getElementById('added-tab').classList.remove('active');
        document.getElementById('removed-tab').classList.remove('active');
        document.getElementById('search-mode').style.display = 'block';
        document.getElementById('browse-mode').style.display = 'none';
        document.getElementById('added-mode').style.display = 'none';
        document.getElementById('removed-mode').style.display = 'none';

        // Show pagination controls for search mode
        document.getElementById('pagination').style.display = 'flex';
        document.getElementById('pagination-top').style.display = 'flex';

        // Update URL to search mode - clear browse hash and set mode=search
        if (window.urlStateManager) {
            // Direct URL update to ensure browse hash is cleared
            window.urlStateManager.updateSearchURL({});
        }

        // Hide browse sort mode toggle
        const sortModeToggle = document.getElementById('browse-sort-mode-toggle');
        if (sortModeToggle) sortModeToggle.style.display = 'none';

        // Show and restore search mode table headers
        const tableHead = document.querySelector('#results-table thead');
        if (tableHead) tableHead.style.display = '';
        this.restoreSearchHeaders();

        // Trigger search refresh
        if (window.searchEngine) {
            window.searchEngine.performSearch();
        }
    }

    restoreSearchHeaders() {
        const thead = document.querySelector('#results-table thead tr');
        thead.innerHTML = `
            <th class="sortable" data-sort="name">Item Name <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="price">Price <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="properties">Properties <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="town">Town <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="shop">Shop <span class="sort-indicator"></span></th>
        `;

        // Re-attach header click handlers for search
        if (window.searchEngine) {
            document.querySelectorAll('#results-table th.sortable').forEach(header => {
                header.addEventListener('click', () => {
                    const sortField = header.dataset.sort;
                    window.searchEngine.handleHeaderSort(sortField);
                });
            });
        }
    }

    switchToBrowse() {
        document.getElementById('search-tab').classList.remove('active');
        document.getElementById('browse-tab').classList.add('active');
        document.getElementById('added-tab').classList.remove('active');
        document.getElementById('removed-tab').classList.remove('active');
        document.getElementById('search-mode').style.display = 'none';
        document.getElementById('browse-mode').style.display = 'block';
        document.getElementById('added-mode').style.display = 'none';
        document.getElementById('removed-mode').style.display = 'none';

        // Hide pagination controls for browse mode
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('pagination-top').style.display = 'none';

        // Hide table headers in browse mode
        const tableHead = document.querySelector('#results-table thead');
        if (tableHead) tableHead.style.display = 'none';

        // Initialize browse data if not done yet
        if (Object.keys(this.townData).length === 0) {
            this.initializeBrowseData();
        } else {
            // Ensure a town is selected when switching to browse mode
            this.ensureTownSelected();
        }

        // Update URL to browse mode
        if (window.urlStateManager) {
            window.urlStateManager.updateBrowseURL({
                town: this.currentTown,
                shop: this.currentShop
            });
        }
    }

    switchToBrowseAndSelectShop(townName, shopName) {
        console.log(`switchToBrowseAndSelectShop called with town: ${townName}, shop: ${shopName}`);

        // Switch to browse mode UI
        document.getElementById('search-tab').classList.remove('active');
        document.getElementById('browse-tab').classList.add('active');
        document.getElementById('added-tab').classList.remove('active');
        document.getElementById('removed-tab').classList.remove('active');
        document.getElementById('search-mode').style.display = 'none';
        document.getElementById('browse-mode').style.display = 'block';
        document.getElementById('added-mode').style.display = 'none';
        document.getElementById('removed-mode').style.display = 'none';

        // Hide pagination controls for browse mode
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('pagination-top').style.display = 'none';

        // Hide table headers in browse mode
        const tableHead = document.querySelector('#results-table thead');
        if (tableHead) tableHead.style.display = 'none';

        // Initialize browse data if not done yet
        if (Object.keys(this.townData).length === 0) {
            this.initializeBrowseData();
        }

        // Select the town and shop
        const townSelect = document.getElementById('browse-town-select');
        if (townSelect && this.townData[townName]) {
            console.log(`Town found in townData: ${townName}`);
            townSelect.value = townName;
            this.selectTown(townName);

            // Give a moment for town to load, then select the shop
            setTimeout(() => {
                console.log(`Checking for shop: ${shopName} in town: ${townName}`);
                console.log(`Available shops:`, Object.keys(this.townData[townName] || {}));

                if (this.townData[townName] && this.townData[townName][shopName]) {
                    console.log(`Shop found! Selecting: ${shopName}`);
                    this.selectShop(townName, shopName);
                } else {
                    console.log(`Shop not found: ${shopName}`);
                }
            }, 50);
        } else {
            console.log(`Town not found or townSelect missing: ${townName}`);
        }
    }

    initializeBrowseData() {
        if (!window.dataLoader || !window.dataLoader.allItems) {
            console.log('Data not loaded yet for browse mode');
            return;
        }

        console.log('Initializing browse data...');
        this.organizeTownData();
        this.populateTownList();

        // Check if there's a hash to navigate to
        if (window.location.hash) {
            this.handleHashChange();
        }
    }

    organizeTownData() {
        const items = window.dataLoader.allItems;
        this.townData = {};
        this.shopMetadata = {}; // Store shop metadata separately

        items.forEach(item => {
            const town = item.town || 'Unknown Town';
            const shop = item.shopName || 'Unknown Shop';
            const roomTitle = item.room || 'Main Room';
            const branch = item.branch || '';
            // Always include branch in room display for consistency with game output
            const room = branch ? `${roomTitle} (${branch})` : roomTitle;

            // Initialize town
            if (!this.townData[town]) {
                this.townData[town] = {};
                this.shopMetadata[town] = {};
            }

            // Initialize shop
            if (!this.townData[town][shop]) {
                this.townData[town][shop] = {};

                // Store shop metadata (from first item encountered for this shop)
                this.shopMetadata[town][shop] = {
                    preamble: item.shopLocation || '',
                    id: item.shopId || '',
                    shopSign: item.shopSign || '',
                    shopOwner: item.shopOwner || ''
                };
            }

            // Initialize room
            if (!this.townData[town][shop][room]) {
                this.townData[town][shop][room] = [];
            }

            // Add item to room
            this.townData[town][shop][room].push(item);
        });

        console.log('Organized data for', Object.keys(this.townData).length, 'towns');
    }

    populateTownList() {
        const townSelect = document.getElementById('browse-town-select');
        townSelect.innerHTML = '';

        // Add default "Select a town..." option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a town...';
        townSelect.appendChild(defaultOption);

        const towns = Object.keys(this.townData).sort();
        towns.forEach(town => {
            const option = document.createElement('option');
            option.value = town;

            // Count total items in town
            let totalItems = 0;
            Object.values(this.townData[town]).forEach(shop => {
                Object.values(shop).forEach(room => {
                    totalItems += room.length;
                });
            });

            option.textContent = `${town} (${totalItems} items)`;
            townSelect.appendChild(option);
        });

        // Set default town selection
        this.setDefaultTownSelection();
    }

    setDefaultTownSelection() {
        const townSelect = document.getElementById('browse-town-select');

        // Try to get saved town from localStorage
        let savedTown = localStorage.getItem('browse-selected-town');

        // If no saved town or saved town doesn't exist, default to Icemule Trace
        if (!savedTown || !this.townData[savedTown]) {
            savedTown = 'Icemule Trace';
            // If Icemule Trace doesn't exist, pick the first available town
            if (!this.townData[savedTown] && Object.keys(this.townData).length > 0) {
                savedTown = Object.keys(this.townData).sort()[0];
            }
        }

        // Select the town in the dropdown and display it
        if (savedTown && this.townData[savedTown]) {
            townSelect.value = savedTown;
            this.selectTown(savedTown);
        }
    }

    ensureTownSelected() {
        const townSelect = document.getElementById('browse-town-select');

        // If no town is currently selected, apply default selection
        if (!townSelect.value || !this.currentTown || !this.townData[this.currentTown]) {
            this.setDefaultTownSelection();
        } else {
            // Re-display the current town to ensure shops are shown
            this.selectTown(this.currentTown);
        }
    }

    selectTown(townName) {
        if (!townName || !this.townData[townName]) {
            this.hideShopList();
            this.hideRoomList();
            return;
        }

        // Save town selection to localStorage
        localStorage.setItem('browse-selected-town', townName);

        this.currentTown = townName;
        this.currentShop = null;
        this.showShopList(townName);
        this.hideRoomList();

        // Update URL with town only (but only if browse tab is active)
        if (window.urlStateManager && this.isActiveMode()) {
            window.urlStateManager.updateBrowseURL({
                town: townName
            });
        }
    }

    showShopList(townName) {
        // Show shop directory in main content area instead of sidebar
        this.displayShopDirectory(townName);

        // Hide sidebar shop list section if it exists
        const shopListSection = document.getElementById('shop-list-section');
        if (shopListSection) {
            shopListSection.style.display = 'none';
        }
    }

    displayShopDirectory(townName) {
        console.log(`displayShopDirectory called for town: ${townName}`);
        const tbody = document.getElementById('results-body');
        const resultsCount = document.getElementById('results-count');
        const pageInfo = document.getElementById('page-info');
        const thead = document.querySelector('#results-table thead');
        const sortModeToggle = document.getElementById('browse-sort-mode-toggle');

        // Hide table headers when showing shop directory
        if (thead) thead.style.display = 'none';

        // Hide sort mode toggle when showing shop list
        if (sortModeToggle) sortModeToggle.style.display = 'none';

        console.log('Found tbody element:', tbody);

        const shops = Object.keys(this.townData[townName]).sort();
        console.log(`Found ${shops.length} shops:`, shops.slice(0, 3));

        // Update header
        resultsCount.textContent = `${shops.length} shops in ${townName}`;
        pageInfo.textContent = '';

        // Clear table and create shop directory
        tbody.innerHTML = '';

        if (shops.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-results">No shops found in this town.</td></tr>';
            return;
        }

        shops.forEach((shopName, index) => {
            try {
                const shop = this.townData[townName][shopName];
                const metadata = this.shopMetadata[townName][shopName] || {};

                // Count items in shop
                let itemCount = 0;
                let roomCount = Object.keys(shop).length;
                Object.values(shop).forEach(room => {
                    itemCount += room.length;
                });

                // Create shop card row
                const shopRow = document.createElement('tr');
                shopRow.className = 'shop-directory-row';

                const locationInfo = this.extractLocationInfo(metadata);

                const shopCard = `
                    <td colspan="5" class="shop-directory-card">
                        <div class="shop-card">
                            <div class="shop-card-header">
                                <div class="shop-card-name">${shopName}</div>
                                <div class="shop-card-stats">
                                    <span class="stat-badge">${itemCount} items</span>
                                    <span class="stat-badge">${roomCount} room${roomCount !== 1 ? 's' : ''}</span>
                                    ${locationInfo ? `<span class="stat-badge location">${locationInfo}</span>` : ''}
                                </div>
                            </div>
                            <div class="shop-card-footer">
                                <div class="shop-card-action">Click to browse inventory →</div>
                                <button class="copy-link-btn" title="Copy link to this shop">🔗 Copy Link</button>
                            </div>
                        </div>
                    </td>
                `;

                shopRow.innerHTML = shopCard;
                shopRow.addEventListener('click', () => this.selectShop(townName, shopName));

                // Add copy link button handler
                const copyButton = shopRow.querySelector('.copy-link-btn');
                copyButton.addEventListener('click', (e) => this.copyShopLink(townName, shopName, e));

                tbody.appendChild(shopRow);

                console.log(`Added shop card ${index + 1}/${shops.length}: ${shopName}`);
            } catch (error) {
                console.error(`Error creating shop card for ${shopName}:`, error);
            }
        });

        console.log(`Finished creating ${shops.length} shop cards for ${townName}`);
    }


    extractLocationInfo(metadata) {
        if (!metadata.preamble) return null;

        // Extract location from preamble like "is located in [East Row, Ebonwood Way]"
        const locationMatch = metadata.preamble.match(/is located in \[([^\]]+)\]/);
        if (locationMatch) {
            return locationMatch[1];
        }

        return null;
    }

    extractOwnerNameFromShopName(shopName) {
        // Extract owner name from shop name for shop_mapping lookups
        // shop_mapping.json uses owner names (e.g., "Painz") not full shop names (e.g., "Painz's Magic Shoppe")
        if (!shopName) return shopName;

        // Extract owner name from patterns like:
        //   "Painz's Magic Shoppe" -> "Painz"
        //   "Dark Tower Imports" -> "Dark Tower Imports" (business name, keep as-is)
        const match = shopName.match(/^(.*?)'s?\s+(Magic Shoppe|Weaponry|Armory|Outfitting|General Store|Combat Gear|Locksmith Shop|Shop|Boutique)/i);
        if (match) {
            return match[1].trim();
        }

        // Check for possessive without shop type
        const possessiveMatch = shopName.match(/^(.*?)'s\s+(.*)$/i);
        if (possessiveMatch) {
            return possessiveMatch[1].trim();
        }

        // Return as-is if no pattern matches (business names)
        return shopName;
    }

    hideShopList() {
        document.getElementById('shop-list-section').style.display = 'none';
    }

    selectShop(townName, shopName) {
        this.currentShop = shopName;
        this.showRoomList(townName, shopName);
        this.showRoomInventory(townName, shopName);

        // Update URL using state manager (but only if browse tab is active)
        if (window.urlStateManager && this.isActiveMode()) {
            window.urlStateManager.updateBrowseURL({
                town: townName,
                shop: shopName
            });
        } else if (this.isActiveMode()) {
            // Fallback to hash for backward compatibility
            this.updateUrlHash(townName, shopName);
        }
    }

    showRoomList(townName, shopName) {
        const roomListSection = document.getElementById('room-list-section');
        const selectedShopName = document.getElementById('selected-shop-name');
        const roomList = document.getElementById('room-list');

        const metadata = this.shopMetadata[townName][shopName] || {};

        // Get shop mapping info from data loader
        // Extract owner name from shopName since shop_mapping uses owner names (e.g., "Painz") not full names (e.g., "Painz's Magic Shoppe")
        const ownerName = this.extractOwnerNameFromShopName(shopName);
        const shopMappingData = window.dataLoader?.shopMapping?.[ownerName];

        // Enhanced shop header with metadata and navigation info
        selectedShopName.innerHTML = `
            <div class="shop-detail-header">
                <div class="shop-detail-name-row">
                    <div class="shop-detail-name">${shopName}</div>
                </div>
                ${shopMappingData ? `
                    <div class="shop-navigation-info">
                        <div class="shop-map-id">📍 Room: ${shopMappingData.map_id}</div>
                        ${shopMappingData.exterior ? `<div class="shop-exterior">Go: ${shopMappingData.exterior}</div>` : ''}
                    </div>
                ` : ''}
                ${metadata.location ? `<div class="shop-detail-location">${metadata.location}</div>` : ''}
                ${metadata.sign ? `<div class="shop-detail-sign">${metadata.sign}</div>` : ''}
            </div>
        `;

        // Setup copy link button in header (it's in the browse-sort-mode-toggle div)
        const copyButton = document.getElementById('browse-copy-link-btn');
        if (copyButton) {
            // Remove any existing listeners to avoid duplicates
            const newCopyButton = copyButton.cloneNode(true);
            copyButton.parentNode.replaceChild(newCopyButton, copyButton);
            newCopyButton.addEventListener('click', (e) => this.copyShopLink(townName, shopName, e));
        }

        roomList.innerHTML = '';

        const rooms = Object.keys(this.townData[townName][shopName]).sort();
        let totalItems = 0;

        rooms.forEach(roomName => {
            const room = this.townData[townName][shopName][roomName];
            totalItems += room.length;

            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            roomDiv.innerHTML = `
                <div class="room-name">${roomName}</div>
                <div class="room-stats">${room.length} items</div>
            `;

            roomDiv.addEventListener('click', () => this.showRoomInventory(townName, shopName, roomName));
            roomList.appendChild(roomDiv);
        });

        // Add shop summary at the top
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'shop-summary';
        summaryDiv.innerHTML = `
            <div class="shop-summary-stats">
                <span class="stat-item">${totalItems} total items</span>
                <span class="stat-item">${rooms.length} rooms</span>
                ${metadata.id ? `<span class="stat-item">Shop ID: ${metadata.id}</span>` : ''}
            </div>
        `;
        roomList.insertBefore(summaryDiv, roomList.firstChild);

        roomListSection.style.display = 'block';
    }

    hideRoomList() {
        document.getElementById('room-list-section').style.display = 'none';
    }

    showRoomInventory(townName, shopName, specificRoom = null) {
        const shop = this.townData[townName][shopName];
        let itemsToShow = [];

        // Show the sort mode toggle when viewing a shop
        const sortModeToggle = document.getElementById('browse-sort-mode-toggle');
        if (sortModeToggle) {
            sortModeToggle.style.display = 'flex';
        }

        if (specificRoom) {
            // Show items from specific room
            itemsToShow = shop[specificRoom] || [];
            this.updateResultsHeader(`${specificRoom} - ${shopName}, ${townName}`, itemsToShow.length);
        } else {
            // Show all items from all rooms in shop
            Object.values(shop).forEach(room => {
                itemsToShow = itemsToShow.concat(room);
            });
            this.updateResultsHeader(`${shopName}, ${townName}`, itemsToShow.length);
        }

        // Group items by room for display
        // Use both room title and branch to create unique keys (handles shops with multiple rooms having the same title)
        const itemsByRoom = {};
        itemsToShow.forEach(item => {
            const roomTitle = item.room || 'Main Room';
            const branch = item.branch || '';
            // Always include branch in room display for consistency with game output
            const roomKey = branch ? `${roomTitle} (${branch})` : roomTitle;
            if (!itemsByRoom[roomKey]) {
                itemsByRoom[roomKey] = [];
            }
            itemsByRoom[roomKey].push(item);
        });

        if (this.sortMode === 'by-room') {
            // Sort items within each room
            this.sortItemsByRoom(itemsByRoom);
            this.displayGroupedItems(itemsByRoom);
        } else {
            // Sort all items together
            const allItems = [];
            Object.values(itemsByRoom).forEach(roomItems => {
                allItems.push(...roomItems);
            });
            this.sortAllItems(allItems);
            this.displayFlatItems(allItems);
        }
    }

    displayGroupedItems(itemsByRoom) {
        const tbody = document.getElementById('results-body');
        const thead = document.querySelector('#results-table thead');
        tbody.innerHTML = '';

        // Show table headers when viewing shop inventory
        if (thead) {
            thead.style.display = '';
            this.setupBrowseHeaders();
        }

        Object.keys(itemsByRoom).sort().forEach(roomName => {
            // Get room sign from first item in room (all items in same room have same sign)
            const roomSign = itemsByRoom[roomName].length > 0 ? itemsByRoom[roomName][0].roomSign : '';

            // Add room header
            const roomHeader = document.createElement('tr');
            roomHeader.className = 'room-header';
            roomHeader.innerHTML = `
                <td colspan="5">
                    <div class="room-header-content">
                        <div class="room-title">
                            <strong>${roomName}</strong> (${itemsByRoom[roomName].length} items)
                        </div>
                        ${roomSign ? `
                            <div class="room-sign">
                                <div class="room-sign-icon">📋</div>
                                <div class="room-sign-text">${roomSign}</div>
                            </div>
                        ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(roomHeader);

            // Add items in room
            itemsByRoom[roomName].forEach(item => {
                const row = this.createItemRow(item);
                tbody.appendChild(row);
            });
        });
    }

    setupBrowseHeaders() {
        const thead = document.querySelector('#results-table thead tr');
        thead.innerHTML = `
            <th class="sortable" data-sort="name">Item Name <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="price">Price <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="properties">Properties <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="town">Town <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="shop">Shop <span class="sort-indicator"></span></th>
        `;

        // Attach header click handlers for browse mode
        document.querySelectorAll('#results-table th.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const sortField = header.dataset.sort;
                this.handleHeaderSort(sortField);
            });
        });

        // Update sort indicators
        this.updateSortIndicators();
    }

    handleHeaderSort(field) {
        // Map header field names to item property names
        let sortField = field;
        if (field === 'shop') sortField = 'shopName';
        if (field === 'properties') sortField = 'propertyCount';

        // Toggle direction if clicking same field, otherwise default to asc
        if (this.currentSort.field === sortField) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Default: price asc, property count desc (most properties first), others asc
            const defaultDirection = (sortField === 'price') ? 'asc' : (sortField === 'propertyCount' ? 'desc' : 'asc');
            this.currentSort = { field: sortField, direction: defaultDirection };
        }

        this.updateSortIndicators();

        // Re-render the current shop with new sort
        if (this.currentTown && this.currentShop) {
            this.showRoomInventory(this.currentTown, this.currentShop);
        }
    }

    updateSortIndicators() {
        // Clear all indicators
        document.querySelectorAll('#results-table th.sortable .sort-indicator').forEach(indicator => {
            indicator.textContent = '';
        });

        // Map internal field names back to header data-sort values
        let headerField = this.currentSort.field;
        if (this.currentSort.field === 'shopName') headerField = 'shop';
        if (this.currentSort.field === 'propertyCount') headerField = 'properties';

        // Set indicator for current sort
        const currentHeader = document.querySelector(`#results-table th[data-sort="${headerField}"]`);
        if (currentHeader) {
            const indicator = currentHeader.querySelector('.sort-indicator');
            indicator.textContent = this.currentSort.direction === 'asc' ? ' ↑' : ' ↓';
        }
    }

    sortItemsByRoom(itemsByRoom) {
        // Sort items within each room
        Object.keys(itemsByRoom).forEach(roomName => {
            itemsByRoom[roomName].sort((a, b) => {
                let aVal = a[this.currentSort.field];
                let bVal = b[this.currentSort.field];

                // Calculate property count dynamically if sorting by properties
                if (this.currentSort.field === 'propertyCount') {
                    aVal = this.calculatePropertyCount(a);
                    bVal = this.calculatePropertyCount(b);
                } else {
                    // Handle null/undefined values for other fields
                    if (aVal == null && bVal == null) return 0;
                    if (aVal == null) return 1;
                    if (bVal == null) return -1;
                }

                // Convert to comparable types
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }

                let result = 0;
                if (aVal < bVal) result = -1;
                else if (aVal > bVal) result = 1;

                return this.currentSort.direction === 'desc' ? -result : result;
            });
        });
    }

    sortAllItems(items) {
        // Sort all items together (ignoring room boundaries)
        items.sort((a, b) => {
            let aVal = a[this.currentSort.field];
            let bVal = b[this.currentSort.field];

            // Calculate property count dynamically if sorting by properties
            if (this.currentSort.field === 'propertyCount') {
                aVal = this.calculatePropertyCount(a);
                bVal = this.calculatePropertyCount(b);
            } else {
                // Handle null/undefined values for other fields
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;
            }

            // Convert to comparable types
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            let result = 0;
            if (aVal < bVal) result = -1;
            else if (aVal > bVal) result = 1;

            return this.currentSort.direction === 'desc' ? -result : result;
        });
    }

    displayFlatItems(items) {
        const tbody = document.getElementById('results-body');
        const thead = document.querySelector('#results-table thead');
        tbody.innerHTML = '';

        // Show table headers when viewing shop inventory
        if (thead) {
            thead.style.display = '';
            this.setupBrowseHeaders();
        }

        // Display all items without room headers
        items.forEach(item => {
            const row = this.createItemRow(item);
            tbody.appendChild(row);
        });
    }

    calculatePropertyCount(item) {
        // Only count enhancive properties (green stat bonuses)
        if (item.enhancives && item.enhancives.length > 0) {
            return item.enhancives.length;
        }
        return 0;
    }

    createItemRow(item) {
        const row = document.createElement('tr');
        row.className = 'item-row';

        const nameCell = document.createElement('td');
        nameCell.className = 'item-name';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = item.name;

        // Register for hover tooltip (raw recall preview)
        if (window.tooltipManager) {
            window.tooltipManager.register(nameSpan, item);
        }

        nameCell.appendChild(nameSpan);

        // Add quantity after name if it exists (with 2 spaces, not underlined)
        if (item.quantity) {
            const quantityText = document.createTextNode(`  (${item.quantity})`);
            nameCell.appendChild(quantityText);
        }

        const priceCell = document.createElement('td');
        priceCell.className = 'item-price';
        priceCell.textContent = this.formatPrice(item.price);

        const propsCell = document.createElement('td');
        propsCell.className = 'item-properties';
        propsCell.appendChild(this.createPropertiesElement(item));

        const townCell = document.createElement('td');
        townCell.className = 'item-town';
        townCell.textContent = item.town;

        const shopCell = document.createElement('td');
        shopCell.className = 'item-shop';
        shopCell.textContent = item.shopName;

        row.appendChild(nameCell);
        row.appendChild(priceCell);
        row.appendChild(propsCell);
        row.appendChild(townCell);
        row.appendChild(shopCell);

        // Add click handler for item details
        row.addEventListener('click', () => this.showItemDetails(item));

        return row;
    }

    createPropertiesElement(item) {
        const container = document.createElement('div');

        // Collect all properties that should be displayed
        const detectedProps = typeof detectPropertiesFromRaw === 'function'
            ? detectPropertiesFromRaw(item.raw)
            : {};

        // Add item type tags to detectedProps
        if (item.itemType) detectedProps[item.itemType] = true;
        if (item.armorType) detectedProps.armor_type = item.armorType;
        if (item.weaponType) detectedProps.weapon_type = item.weaponType;
        if (item.shieldType) detectedProps.shield_type = item.shieldType;
        if (item.capacityLevel) detectedProps.capacity = item.capacityLevel;
        if (item.enchant) detectedProps.enchant = item.enchant;

        // Add skill (but don't duplicate weapon type)
        if (item.skill && (!item.weaponType || item.skill !== item.weaponType)) {
            detectedProps._skill = item.skill; // Use _skill to avoid conflicts
        }

        // Merge with existing extracted properties from the data
        if (item.td_bonus) detectedProps.td_bonus = item.td_bonus;
        if (item.sanctify) detectedProps.sanctify = item.sanctify;
        if (item.ensorcell) detectedProps.ensorcell = item.ensorcell;
        if (item.dmg_padding) detectedProps.dmg_padding = item.dmg_padding;
        if (item.crit_padding) detectedProps.crit_padding = item.crit_padding;
        if (item.dmg_weighting) detectedProps.dmg_weighting = item.dmg_weighting;
        if (item.crit_weighting) detectedProps.crit_weighting = item.crit_weighting;
        if (item.sighting) detectedProps.sighting = item.sighting;
        if (item.blessing) detectedProps.holy = true;
        if (item.flares && item.flares.length > 0) detectedProps.flares = true;
        if (item.enhancives && item.enhancives.length > 0) detectedProps.enhancive = true;

        // Chrism detection: price 1k-20k AND "But you are not holding" in raw text
        if (item.price >= 1000 && item.price <= 20000 && item.raw && item.raw.some(line => line.includes('But you are not holding'))) {
            detectedProps.chrism = true;
        }

        // Check tags for boolean properties
        if (item.tags && item.tags.length > 0) {
            const boolTags = ['spiked', 'magic_resistant', 'scripted', 'holy_fire',
                              'max_light', 'max_deep', 'persists', 'crumbly', 'holy',
                              'lightenable', 'deepenable', 'imbeddable'];
            item.tags.forEach(tag => {
                // Skip any tag that's too long (likely invalid data)
                if (typeof tag !== 'string' || tag.length > 30) return;
                if (boolTags.includes(tag)) {
                    detectedProps[tag] = true;
                }
            });
        }

        // Display detected properties respecting tag visibility and order
        const orderedTags = typeof getOrderedTagIds === 'function'
            ? getOrderedTagIds()
            : (typeof TAG_DEFINITIONS !== 'undefined' ? Object.keys(TAG_DEFINITIONS) : []);

        orderedTags.forEach(tagId => {
            // Special handling for item type tags (weapon, armor, shield, container, jewelry)
            if (['weapon', 'armor', 'shield', 'container', 'jewelry'].includes(tagId)) {
                if (detectedProps[tagId] && (typeof isTagVisible !== 'function' || isTagVisible(tagId))) {
                    const tag = document.createElement('span');
                    tag.className = 'property-tag cat-item_type';
                    tag.dataset.category = 'item_type';
                    const tagColor = typeof getTagColor === 'function' ? getTagColor(tagId) : null;
                    if (tagColor) {
                        tag.style.color = tagColor;
                        tag.style.borderColor = tagColor;
                        tag.style.backgroundColor = 'transparent';
                    }
                    tag.textContent = tagId.charAt(0).toUpperCase() + tagId.slice(1);
                    container.appendChild(tag);
                }
                return;
            }

            // Special handling for enchant
            if (tagId === 'enchant') {
                if (detectedProps.enchant && (typeof isTagVisible !== 'function' || isTagVisible('enchant'))) {
                    const tag = document.createElement('span');
                    tag.className = 'property-tag cat-magical';
                    tag.dataset.category = 'magical';
                    const tagColor = typeof getTagColor === 'function' ? getTagColor('enchant') : null;
                    if (tagColor) {
                        tag.style.color = tagColor;
                        tag.style.borderColor = tagColor;
                        tag.style.backgroundColor = 'transparent';
                    }
                    tag.textContent = `+${detectedProps.enchant}`;
                    container.appendChild(tag);
                }
                return;
            }

            // Special handling for capacity
            if (tagId === 'capacity') {
                if (detectedProps.capacity) {
                    const tag = document.createElement('span');
                    tag.className = 'property-tag special';
                    tag.textContent = detectedProps.capacity.charAt(0).toUpperCase() + detectedProps.capacity.slice(1);
                    container.appendChild(tag);
                }
                return;
            }

            // Special handling for armor_type
            if (tagId === 'armor_type') {
                if (detectedProps.armor_type && (typeof isTagVisible !== 'function' || isTagVisible('armor_type'))) {
                    const tag = document.createElement('span');
                    tag.className = 'property-tag cat-item_type';
                    tag.dataset.category = 'item_type';
                    const tagColor = typeof getTagColor === 'function' ? getTagColor('armor_type') : null;
                    if (tagColor) {
                        tag.style.color = tagColor;
                        tag.style.borderColor = tagColor;
                        tag.style.backgroundColor = 'transparent';
                    }
                    tag.textContent = detectedProps.armor_type.charAt(0).toUpperCase() + detectedProps.armor_type.slice(1);
                    container.appendChild(tag);
                }
                return;
            }

            // Special handling for weapon_type
            if (tagId === 'weapon_type') {
                if (detectedProps.weapon_type && (typeof isTagVisible !== 'function' || isTagVisible('weapon_type'))) {
                    const tag = document.createElement('span');
                    tag.className = 'property-tag cat-item_type';
                    tag.dataset.category = 'item_type';
                    const tagColor = typeof getTagColor === 'function' ? getTagColor('weapon_type') : null;
                    if (tagColor) {
                        tag.style.color = tagColor;
                        tag.style.borderColor = tagColor;
                        tag.style.backgroundColor = 'transparent';
                    }
                    tag.textContent = detectedProps.weapon_type.charAt(0).toUpperCase() + detectedProps.weapon_type.slice(1);
                    container.appendChild(tag);
                }
                return;
            }

            // Special handling for shield_type
            if (tagId === 'shield_type') {
                if (detectedProps.shield_type && (typeof isTagVisible !== 'function' || isTagVisible('shield_type'))) {
                    const tag = document.createElement('span');
                    tag.className = 'property-tag cat-item_type';
                    tag.dataset.category = 'item_type';
                    const tagColor = typeof getTagColor === 'function' ? getTagColor('shield_type') : null;
                    if (tagColor) {
                        tag.style.color = tagColor;
                        tag.style.borderColor = tagColor;
                        tag.style.backgroundColor = 'transparent';
                    }
                    tag.textContent = detectedProps.shield_type.charAt(0).toUpperCase() + detectedProps.shield_type.slice(1);
                    container.appendChild(tag);
                }
                return;
            }

            // Special handling for 'enhancive' - display individual enhancive stats
            if (tagId === 'enhancive') {
                const enhancivesVisible = typeof isTagEnabled === 'function' ? isTagEnabled('enhancive') : true;
                if (enhancivesVisible && item.enhancives && item.enhancives.length > 0) {
                    const enhColor = typeof getTagColor === 'function' ? getTagColor('enhancive') : '#27ae60';
                    item.enhancives.forEach(enh => {
                        const enhTag = document.createElement('span');
                        enhTag.className = 'property-tag special';
                        enhTag.dataset.category = 'enhancive';
                        enhTag.style.color = enhColor;
                        enhTag.style.borderColor = enhColor;
                        enhTag.textContent = `+${enh.boost} ${enh.ability}`;
                        container.appendChild(enhTag);
                    });
                }
                return; // Don't show a generic "Enhancive" tag, we show the individual stats
            }

            // Special handling for 'flares' - we handle flares display separately
            if (tagId === 'flares') {
                if (item.flares && item.flares.length > 0) {
                    if (typeof isTagVisible === 'function' && !isTagVisible('flares')) return;
                    const flareColor = typeof getTagColor === 'function' ? getTagColor('flares') : '#9b59b6';
                    const flareTag = document.createElement('span');
                    flareTag.className = 'property-tag special';
                    flareTag.dataset.category = 'magical';
                    flareTag.style.color = flareColor;
                    flareTag.style.borderColor = flareColor;
                    flareTag.textContent = 'Flares';
                    container.appendChild(flareTag);
                }
                return;
            }

            if (detectedProps[tagId] !== undefined && detectedProps[tagId] !== false) {
                // Check tag visibility
                if (typeof isTagVisible === 'function' && !isTagVisible(tagId)) return;

                const tagEl = document.createElement('span');
                const tagColor = typeof getTagColor === 'function' ? getTagColor(tagId) : null;
                const tagCategory = typeof getCategoryForTag === 'function' ? getCategoryForTag(tagId) : null;
                tagEl.className = 'property-tag special';
                if (tagCategory) {
                    tagEl.dataset.category = tagCategory;
                }
                if (tagColor) {
                    tagEl.style.color = tagColor;
                    tagEl.style.borderColor = tagColor;
                }
                const displayText = typeof formatPropertyDisplay === 'function'
                    ? formatPropertyDisplay(tagId, detectedProps[tagId], detectedProps)
                    : tagId.replace(/_/g, ' ');
                // Skip if formatPropertyDisplay returns null (tag too long or invalid)
                if (!displayText) return;
                // Final safety check - skip any tag text longer than 50 characters
                if (displayText.length > 50) {
                    console.warn('Skipping long tag:', tagId, displayText.substring(0, 50) + '...');
                    return;
                }
                tagEl.textContent = displayText;
                container.appendChild(tagEl);
            }
        });

        // Skill tag (rendered after ordered tags if it's not a duplicate of weapon type)
        if (detectedProps._skill) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = detectedProps._skill.charAt(0).toUpperCase() + detectedProps._skill.slice(1);
            container.appendChild(tag);
        }

        // Gemstone rarity tags
        if (item.gemstoneProperties && item.gemstoneProperties.length > 0) {
            const rarityOrder = ['regional', 'common', 'rare', 'legendary'];
            const rarities = new Set();

            // Collect all unique rarities
            item.gemstoneProperties.forEach(prop => {
                if (prop.rarity) {
                    rarities.add(prop.rarity.toLowerCase());
                }
            });

            // Add rarity tags in the correct order
            rarityOrder.forEach(rarity => {
                if (rarities.has(rarity)) {
                    const rarityTag = document.createElement('span');
                    rarityTag.className = `property-tag rarity rarity-${rarity}`;
                    rarityTag.textContent = rarity.charAt(0).toUpperCase() + rarity.slice(1);
                    container.appendChild(rarityTag);
                }
            });
        }

        return container;
    }

    formatPrice(price) {
        if (price >= 1000000) {
            return (price / 1000000).toFixed(1) + 'M';
        } else if (price >= 1000) {
            return (price / 1000).toFixed(1) + 'k';
        }
        return price.toString();
    }

    showItemDetails(item) {
        // Use existing modal functionality from search engine
        if (window.searchEngine && window.searchEngine.showItemDetails) {
            window.searchEngine.showItemDetails(item);
        } else {
            // Fallback: simple alert if search engine not available
            alert(`${item.name}\nPrice: ${this.formatPrice(item.price)}\nShop: ${item.shopName}\nTown: ${item.town}`);
        }
    }

    updateResultsHeader(title, count) {
        document.getElementById('results-count').textContent = `${count} items in ${title}`;
        document.getElementById('page-info').textContent = '';
    }

    backToShops() {
        console.log('backToShops() called');
        console.log('currentTown:', this.currentTown);

        // Hide the room list sidebar
        this.hideRoomList();

        // Clear shop from URL (but only if browse tab is active)
        if (window.urlStateManager && this.currentTown && this.isActiveMode()) {
            window.urlStateManager.updateBrowseURL({
                town: this.currentTown
            });
        } else if (this.isActiveMode()) {
            // Fallback to hash for backward compatibility
            this.clearUrlHash();
        }

        // Check if we have an active search
        const searchQuery = document.getElementById('shop-sign-search-input').value.trim();
        const searchAllTowns = document.getElementById('search-all-towns').checked;

        if (searchQuery) {
            // If there's an active search, re-run it to show the search results
            this.searchShopSigns();
        } else if (this.currentTown) {
            // Otherwise, display the shop directory for the current town
            this.displayShopDirectory(this.currentTown);
        } else {
            console.log('No currentTown set and no active search');
        }

        // Clear the current shop selection
        this.currentShop = null;
    }

    searchShopSigns() {
        const searchQuery = document.getElementById('shop-sign-search-input').value.toLowerCase().trim();
        const searchAllTowns = document.getElementById('search-all-towns').checked;

        if (!searchQuery) {
            // If empty search, show normal view
            if (this.currentTown && !searchAllTowns) {
                this.displayShopDirectory(this.currentTown);
            }
            return;
        }

        // Get towns to search
        let townsToSearch = [];
        if (searchAllTowns) {
            townsToSearch = Object.keys(this.townData);
        } else if (this.currentTown) {
            townsToSearch = [this.currentTown];
        } else {
            // No town selected and not searching all
            document.getElementById('results-body').innerHTML = '<tr><td colspan="5" class="no-results">Please select a town or check "Search all towns".</td></tr>';
            return;
        }

        // Search for shops with matching signs, names, or owners
        const matchingShops = [];

        townsToSearch.forEach(townName => {
            const shops = this.shopMetadata[townName];
            if (!shops) return;

            Object.entries(shops).forEach(([shopName, metadata]) => {
                const shopSign = (metadata.shopSign || '').toLowerCase();
                const shopNameLower = shopName.toLowerCase();
                const shopOwner = (metadata.shopOwner || '').toLowerCase();

                // Check if shop sign, name, or owner contains the search query
                if ((shopSign && shopSign.includes(searchQuery)) ||
                    shopNameLower.includes(searchQuery) ||
                    (shopOwner && shopOwner.includes(searchQuery))) {
                    matchingShops.push({
                        town: townName,
                        shopName: shopName,
                        shopSign: metadata.shopSign,
                        shopOwner: metadata.shopOwner,
                        preamble: metadata.preamble,
                        itemCount: this.getShopItemCount(townName, shopName),
                        roomCount: Object.keys(this.townData[townName][shopName] || {}).length
                    });
                }
            });
        });

        // Display results
        this.displayShopSignSearchResults(matchingShops, searchQuery, searchAllTowns);
    }

    clearShopSignSearch() {
        document.getElementById('shop-sign-search-input').value = '';
        document.getElementById('search-all-towns').checked = false;

        // Return to normal view
        if (this.currentTown) {
            this.displayShopDirectory(this.currentTown);
        }
    }

    getShopItemCount(townName, shopName) {
        let count = 0;
        const shop = this.townData[townName][shopName];
        if (shop) {
            Object.values(shop).forEach(room => {
                count += room.length;
            });
        }
        return count;
    }

    displayShopSignSearchResults(shops, searchQuery, searchedAllTowns) {
        const tbody = document.getElementById('results-body');
        const resultsCount = document.getElementById('results-count');
        const pageInfo = document.getElementById('page-info');
        const thead = document.querySelector('#results-table thead');
        const sortModeToggle = document.getElementById('browse-sort-mode-toggle');

        // Hide table headers when showing shop search results
        if (thead) thead.style.display = 'none';

        // Hide sort mode toggle when showing shop search results
        if (sortModeToggle) sortModeToggle.style.display = 'none';

        // Update header
        const scope = searchedAllTowns ? 'all towns' : this.currentTown;
        resultsCount.textContent = `${shops.length} shops found with "${searchQuery}" in signs (${scope})`;
        pageInfo.textContent = '';

        // Clear table
        tbody.innerHTML = '';

        if (shops.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-results">No shops found with matching signs.</td></tr>';
            return;
        }

        // Sort by town, then shop name
        shops.sort((a, b) => {
            if (a.town !== b.town) return a.town.localeCompare(b.town);
            return a.shopName.localeCompare(b.shopName);
        });

        // Display each matching shop
        shops.forEach((shopInfo) => {
            const shopRow = document.createElement('tr');
            shopRow.className = 'shop-directory-row clickable';

            const locationInfo = this.extractLocationInfo({ preamble: shopInfo.preamble });

            const shopCard = `
                <td colspan="5" class="shop-directory-card">
                    <div class="shop-card">
                        <div class="shop-card-header">
                            <div class="shop-card-name">${shopInfo.shopName}</div>
                            <div class="shop-card-stats">
                                <span class="stat-badge">${shopInfo.itemCount} items</span>
                                <span class="stat-badge">${shopInfo.roomCount} rooms</span>
                                ${searchedAllTowns ? `<span class="stat-badge town-badge">${shopInfo.town}</span>` : ''}
                            </div>
                        </div>
                        ${locationInfo ? `<div class="shop-card-location">${locationInfo}</div>` : ''}
                        <div class="shop-card-sign">${this.highlightSearchTerm(shopInfo.shopSign, searchQuery)}</div>
                        <div class="shop-card-footer">
                            <button class="copy-link-btn" title="Copy link to this shop">🔗 Copy Link</button>
                        </div>
                    </div>
                </td>
            `;

            shopRow.innerHTML = shopCard;

            // Add copy link button handler
            const copyButton = shopRow.querySelector('.copy-link-btn');
            copyButton.addEventListener('click', (e) => this.copyShopLink(shopInfo.town, shopInfo.shopName, e));

            // Add click handler to view shop
            shopRow.addEventListener('click', () => {
                // If searching all towns and clicking a shop from a different town
                if (searchedAllTowns && shopInfo.town !== this.currentTown) {
                    // Update the town select dropdown but don't trigger displayShopDirectory
                    const townSelect = document.getElementById('browse-town-select');
                    townSelect.value = shopInfo.town;
                    this.currentTown = shopInfo.town;

                    // Save town selection to localStorage
                    localStorage.setItem('browse-selected-town', shopInfo.town);
                }

                // Directly select the shop without refreshing the shop list
                this.selectShopDirect(shopInfo.town, shopInfo.shopName);
            });

            tbody.appendChild(shopRow);
        });
    }

    highlightSearchTerm(text, searchTerm) {
        if (!text || !searchTerm) return text;

        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    selectShopDirect(townName, shopName) {
        // This method selects a shop directly without refreshing the shop directory
        // Used when clicking on search results to preserve the search view

        if (!townName || !shopName) return;

        // Update current selections
        this.currentShop = shopName;

        // Show the shop's room list in the sidebar
        this.showRoomList(townName, shopName);

        // Display the shop's inventory in the main area
        this.showRoomInventory(townName, shopName);

        // Update URL hash
        this.updateUrlHash(townName, shopName);
    }
}

// Initialize browse engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.browseEngine = new BrowseEngine();
});

// Initialize browse data when main data is loaded
window.addEventListener('dataLoaded', () => {
    if (window.browseEngine) {
        window.browseEngine.initializeBrowseData();
    }
});