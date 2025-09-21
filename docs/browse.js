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

        // Initialize browse data if not done yet
        if (Object.keys(this.townData).length === 0) {
            this.initializeBrowseData();
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
                    id: item.shopId || ''
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
    }

    selectTown(townName) {
        if (!townName || !this.townData[townName]) {
            this.hideShopList();
            this.hideRoomList();
            return;
        }

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

        if (this.currentTown) {
            // Hide the room list sidebar
            this.hideRoomList();

            // Display the shop directory in the main area
            this.displayShopDirectory(this.currentTown);

            // Clear the current shop selection
            this.currentShop = null;
        } else {
            console.log('No currentTown set, cannot display shop directory');
        }
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