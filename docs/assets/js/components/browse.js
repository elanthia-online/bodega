class BrowseEngine {
    constructor() {
        this.currentTown = null;
        this.currentShop = null;
        this.townData = {};
        this.initializeEventListeners();
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

        // Trigger search refresh
        if (window.searchEngine) {
            window.searchEngine.performSearch();
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

        // Initialize browse data if not done yet
        if (Object.keys(this.townData).length === 0) {
            this.initializeBrowseData();
        } else {
            // Ensure a town is selected when switching to browse mode
            this.ensureTownSelected();
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
    }

    organizeTownData() {
        const items = window.dataLoader.allItems;
        this.townData = {};
        this.shopMetadata = {}; // Store shop metadata separately

        items.forEach(item => {
            const town = item.town || 'Unknown Town';
            const shop = item.shopName || 'Unknown Shop';
            const room = item.room || 'Main Room';

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
                    shopSign: item.shopSign || ''
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
    }

    showShopList(townName) {
        // Show shop directory in main content area instead of sidebar
        this.displayShopDirectory(townName);

        // Hide sidebar shop list section
        const shopListSection = document.getElementById('shop-list-section');
        shopListSection.style.display = 'none';
    }

    displayShopDirectory(townName) {
        console.log(`displayShopDirectory called for town: ${townName}`);
        const tbody = document.getElementById('results-body');
        const resultsCount = document.getElementById('results-count');
        const pageInfo = document.getElementById('page-info');

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
                            </div>
                        </div>
                    </td>
                `;

                shopRow.innerHTML = shopCard;
                shopRow.addEventListener('click', () => this.selectShop(townName, shopName));
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

    hideShopList() {
        document.getElementById('shop-list-section').style.display = 'none';
    }

    selectShop(townName, shopName) {
        this.currentShop = shopName;
        this.showRoomList(townName, shopName);
        this.showRoomInventory(townName, shopName);
    }

    showRoomList(townName, shopName) {
        const roomListSection = document.getElementById('room-list-section');
        const selectedShopName = document.getElementById('selected-shop-name');
        const roomList = document.getElementById('room-list');

        const metadata = this.shopMetadata[townName][shopName] || {};

        // Get shop mapping info from data loader
        const shopMappingData = window.dataLoader?.shopMapping?.[shopName];

        // Enhanced shop header with metadata and navigation info
        selectedShopName.innerHTML = `
            <div class="shop-detail-header">
                <div class="shop-detail-name">${shopName}</div>
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
        const itemsByRoom = {};
        itemsToShow.forEach(item => {
            const room = item.room || 'Main Room';
            if (!itemsByRoom[room]) {
                itemsByRoom[room] = [];
            }
            itemsByRoom[room].push(item);
        });

        this.displayGroupedItems(itemsByRoom);
    }

    displayGroupedItems(itemsByRoom) {
        const tbody = document.getElementById('results-body');
        tbody.innerHTML = '';

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

    createItemRow(item) {
        const row = document.createElement('tr');
        row.className = 'item-row';

        const properties = this.formatItemProperties(item);

        row.innerHTML = `
            <td class="item-name">
                <span class="name">${item.name}</span>
                ${item.enchant > 0 ? `<span class="enchant">+${item.enchant}</span>` : ''}
            </td>
            <td class="item-price">${this.formatPrice(item.price)}</td>
            <td class="item-properties">${properties}</td>
            <td class="item-town">${item.town}</td>
            <td class="item-shop">${item.shopName}</td>
        `;

        // Add click handler for item details
        row.addEventListener('click', () => this.showItemDetails(item));

        return row;
    }

    formatItemProperties(item) {
        const props = [];

        if (item.itemType) {
            props.push(item.itemType);
        }
        if (item.capacity) {
            props.push(`${item.capacityLevel} capacity`);
        }
        if (item.flares && item.flares.length > 0) {
            props.push(`${item.flares.join(', ')} flares`);
        }
        if (item.spell) {
            props.push('spell');
        }
        if (item.isEnhancive) {
            props.push('enhancive');
        }
        if (item.blessing) {
            props.push(item.blessing);
        }

        return props.join(', ');
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

        // Search for shops with matching signs
        const matchingShops = [];

        townsToSearch.forEach(townName => {
            const shops = this.shopMetadata[townName];
            if (!shops) return;

            Object.entries(shops).forEach(([shopName, metadata]) => {
                const shopSign = (metadata.shopSign || '').toLowerCase();

                // Check if shop sign contains the search query
                if (shopSign && shopSign.includes(searchQuery)) {
                    matchingShops.push({
                        town: townName,
                        shopName: shopName,
                        shopSign: metadata.shopSign,
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
                    </div>
                </td>
            `;

            shopRow.innerHTML = shopCard;

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