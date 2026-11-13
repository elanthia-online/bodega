// Recently Added Items System
class AddedEngine {
    constructor() {
        this.addedItems = [];
        this.filteredItems = [];
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.currentSort = { field: 'addedDate', direction: 'desc' };

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Tab switching
        document.getElementById('added-tab').addEventListener('click', () => this.switchToAdded());

        // Search controls
        document.getElementById('added-search-input').addEventListener('input', this.debounce(() => {
            this.performSearch();
        }, 300));

        document.getElementById('added-search-btn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('added-clear-btn').addEventListener('click', () => {
            this.clearSearch();
        });

        // Filter controls
        document.getElementById('added-apply-filters').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('added-reset-filters').addEventListener('click', () => {
            this.resetFilters();
        });

        // Pagination controls
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.isActiveMode()) this.previousPage();
        });
        document.getElementById('next-page').addEventListener('click', () => {
            if (this.isActiveMode()) this.nextPage();
        });
        document.getElementById('prev-page-top').addEventListener('click', () => {
            if (this.isActiveMode()) this.previousPage();
        });
        document.getElementById('next-page-top').addEventListener('click', () => {
            if (this.isActiveMode()) this.nextPage();
        });
    }

    debounce(func, wait) {
        return BodegaShared.debounce(func, wait);
    }

    updateTableHeaders() {
        const thead = document.querySelector('#results-table thead tr');
        thead.innerHTML = `
            <th class="sortable" data-sort="name" scope="col"><button type="button" class="sort-button">Item Name<span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th class="sortable" data-sort="added" scope="col"><button type="button" class="sort-button">Added<span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th class="sortable" data-sort="price" scope="col"><button type="button" class="sort-button">Price<span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th class="sortable" data-sort="properties" scope="col"><button type="button" class="sort-button">Properties<span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th class="sortable" data-sort="town" scope="col"><button type="button" class="sort-button">Town<span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th class="sortable" data-sort="shop" scope="col"><button type="button" class="sort-button">Shop<span class="sort-indicator" aria-hidden="true"></span></button></th>
        `;

        // Re-attach header click handlers
        document.querySelectorAll('#results-table th.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const sortField = header.dataset.sort;
                this.handleHeaderSort(sortField);
            });
        });
    }

    switchToAdded() {
        BodegaShared.activateMode('added');

        // Show pagination controls for added mode
        document.getElementById('pagination').style.display = 'flex';
        document.getElementById('pagination-top').style.display = 'flex';

        // Hide browse sort mode toggle
        const sortModeToggle = document.getElementById('browse-sort-mode-toggle');
        if (sortModeToggle) sortModeToggle.style.display = 'none';

        // Show and update table headers for added mode
        const tableHead = document.querySelector('#results-table thead');
        if (tableHead) tableHead.style.display = '';
        this.updateTableHeaders();
        this.updateSortIndicators();

        // Load added data on first use, then search
        this.initializeAddedData();

        // Update URL to added mode
        if (window.urlStateManager) {
            this.updateURLState();
        }
    }

    // added_items.json is fetched the first time this tab is opened
    // (not at page load), so show a loading row until it arrives.
    async initializeAddedData() {
        if (!this.dataReady) {
            this.showLoadingRow();
            try {
                this.addedItems = await window.dataLoader.ensureAddedItems();
            } catch (error) {
                console.error('Failed to load recently added items:', error);
                this.addedItems = [];
            }
            // An empty result usually means the fetch failed; retry next time
            this.dataReady = this.addedItems.length > 0;
        this.populateTownFilter();
        }

        // A town filter restored from the URL waits for the town options
        if (this.pendingTown) {
            document.getElementById('added-town-filter').value = this.pendingTown;
            this.pendingTown = null;
        }

        // The user may have switched tabs while the data was loading
        if (!this.isActiveMode()) return;
        this.performSearch();
    }

    showLoadingRow() {
        if (!this.isActiveMode()) return;
        document.getElementById('results-body').innerHTML =
            '<tr><td colspan="6" class="no-results">Loading recently added items…</td></tr>';
        document.getElementById('results-count').textContent = 'Loading recently added items…';
        document.getElementById('page-info').textContent = '';
        BodegaShared.renderPagination(1, 0, () => {});
    }

    populateTownFilter() {
        const townFilter = document.getElementById('added-town-filter');
        const uniqueTowns = [...new Set(this.addedItems.map(item => item.town))].sort();

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

    performSearch() {
        const filters = this.getFilters();
        this.filteredItems = this.addedItems.filter(item => this.matchesAllFilters(item, filters));

        this.sortItems();
        this.currentPage = 1; // Reset to first page when searching
        this.displayResults();
        this.updateResultsHeader();
        this.updateURLState();
    }

    updateURLState() {
        if (!window.urlStateManager) return;
        // Only update URL if added tab is actually active
        if (!this.isActiveMode()) return;

        window.urlStateManager.updateAddedURL({
            days: document.getElementById('added-date-filter')?.value,
            query: document.getElementById('added-search-input')?.value,
            town: document.getElementById('added-town-filter')?.value,
            priceRange: document.getElementById('added-price-filter')?.value
        });
    }

    getFilters() {
        return {
            search: document.getElementById('added-search-input').value.trim(),
            days: document.getElementById('added-date-filter').value,
            priceRange: document.getElementById('added-price-filter').value,
            town: document.getElementById('added-town-filter').value
        };
    }

    matchesAllFilters(item, filters) {
        // Search text filter
        if (filters.search && !this.matchesSearchText(item.searchText || item.name, filters.search)) {
            return false;
        }

        // Days filter (only show items added within the timeframe)
        if (filters.days && filters.days !== 'all') {
            const daysAgo = parseInt(filters.days);
            const addedDate = new Date(item.addedDate);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

            if (addedDate < cutoffDate) {
                return false;
            }
        } else if (!filters.days) {
            // Default to last 24 hours if no filter selected
            const addedDate = new Date(item.addedDate);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 1);

            if (addedDate < cutoffDate) {
                return false;
            }
        }
        // If filters.days === 'all', don't filter by date at all

        // Price range filter
        if (filters.priceRange) {
            const [min, max] = filters.priceRange.split('-').map(Number);
            // Null-priced (free/unpriced) items only match when the range
            // starts at 0; otherwise a null price must not coerce to 0 and
            // sneak into "under 1k" etc.
            const price = item.price !== null && item.price !== undefined ? item.price : (min === 0 ? 0 : NaN);
            if (price < min || price > max) {
                return false;
            }
        }

        // Town filter
        if (filters.town && item.town !== filters.town) {
            return false;
        }

        return true;
    }

    matchesSearchText(itemText, searchQuery) {
        if (!searchQuery) return true;

        const text = itemText.toLowerCase();
        const query = searchQuery.toLowerCase();

        // Simple text search for now
        return text.includes(query);
    }

    handleHeaderSort(field) {
        // Map header field names to item property names
        let sortField = field;
        if (field === 'added') sortField = 'addedDate';
        if (field === 'shop') sortField = 'shopName';
        if (field === 'properties') sortField = 'propertyCount';

        // Toggle direction if clicking same field, otherwise default appropriately
        if (this.currentSort.field === sortField) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Default: price asc, added desc (newest first), property count desc, others asc
            const defaultDirection = (sortField === 'addedDate' || sortField === 'propertyCount') ? 'desc' : (sortField === 'price' ? 'asc' : 'asc');
            this.currentSort = { field: sortField, direction: defaultDirection };
        }

        this.updateSortIndicators();
        this.performSearch();
    }

    updateSortIndicators() {
        // Map internal field names back to header data-sort values
        let headerField = this.currentSort.field;
        if (this.currentSort.field === 'addedDate') headerField = 'added';
        if (this.currentSort.field === 'shopName') headerField = 'shop';
        if (this.currentSort.field === 'propertyCount') headerField = 'properties';

        BodegaShared.updateSortHeaders(headerField, this.currentSort.direction);
    }

    sortItems() {
        this.filteredItems.sort((a, b) => {
            let aValue = a[this.currentSort.field];
            let bValue = b[this.currentSort.field];

            // Calculate property count dynamically if sorting by properties
            if (this.currentSort.field === 'propertyCount') {
                aValue = this.calculatePropertyCount(a);
                bValue = this.calculatePropertyCount(b);
                // For property count, 0 is a valid value, so don't treat as null
            } else {
                // Handle dates
                if (this.currentSort.field === 'addedDate') {
                    aValue = new Date(aValue);
                    bValue = new Date(bValue);
                }

                // Handle nulls
                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';
            }

            if (this.currentSort.direction === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }

    calculatePropertyCount(item) {
        return BodegaShared.calculatePropertyCount(item);
    }

    displayResults() {
        const tbody = document.getElementById('results-body');
        tbody.innerHTML = '';

        if (this.filteredItems.length === 0) {
            this.displayNoResults();
            this.updatePagination(0);
            return;
        }

        // Calculate pagination
        const totalItems = this.filteredItems.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);

        // Display only current page items
        const pageItems = this.filteredItems.slice(startIndex, endIndex);

        pageItems.forEach(item => {
            const row = this.createAddedItemRow(item);
            tbody.appendChild(row);
        });

        this.updatePagination(totalItems);
    }

    createAddedItemRow(item) {
        const row = document.createElement('tr');
        row.className = 'item-row added-item';

        const addedDate = new Date(item.addedDate);
        const properties = this.createPropertiesElement(item);

        // Create the table cells manually to add event handlers properly
        const nameCell = document.createElement('td');
        nameCell.className = 'item-name';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = item.name;
        BodegaShared.makeActivatable(nameSpan);
        nameCell.appendChild(nameSpan);

        // Add quantity after name if it exists (with 2 spaces, not underlined)
        if (item.quantity) {
            const quantityText = document.createTextNode(`  (${item.quantity})`);
            nameCell.appendChild(quantityText);
        }

        // Register for hover tooltip (raw recall preview)
        if (window.tooltipManager) {
            window.tooltipManager.register(nameSpan, item);
        }

        nameCell.addEventListener('click', () => this.showItemDetails(item));

        const priceCell = document.createElement('td');
        priceCell.className = 'item-price';
        priceCell.textContent = this.formatPrice(item.price);
        priceCell.addEventListener('click', () => this.showItemDetails(item));

        const propertiesCell = document.createElement('td');
        propertiesCell.className = 'item-properties';
        propertiesCell.appendChild(properties);
        propertiesCell.addEventListener('click', () => this.showItemDetails(item));

        const townCell = document.createElement('td');
        townCell.className = 'item-town';
        townCell.textContent = item.town || 'Unknown';
        townCell.addEventListener('click', () => this.showItemDetails(item));

        // Shop cell with clickable link
        const shopCell = document.createElement('td');
        shopCell.className = 'item-shop';

        if (item.shopName) {
            const shopDiv = document.createElement('div');

            // Create clickable shop name link
            const shopLink = document.createElement('a');
            shopLink.href = '#';
            shopLink.className = 'shop-link';
            const shopStrong = document.createElement('strong');
            shopStrong.textContent = item.shopName;
            shopLink.appendChild(shopStrong);
            shopLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigateToShopInBrowse(item.town, item.shopName);
            });

            // Create room span
            const roomSpan = document.createElement('span');
            roomSpan.className = 'shop-location';
            roomSpan.textContent = item.room || '';

            // Append shop link and room to div
            shopDiv.appendChild(shopLink);
            if (item.room) {
                shopDiv.appendChild(document.createElement('br'));
                shopDiv.appendChild(roomSpan);
            }

            shopCell.appendChild(shopDiv);
        } else {
            shopCell.textContent = item.room || item.shop || 'Unknown';
            shopCell.addEventListener('click', () => this.showItemDetails(item));
        }

        // Added time cell
        const addedCell = document.createElement('td');
        addedCell.className = 'item-added-time';
        addedCell.textContent = this.formatRelativeTime(addedDate);
        addedCell.addEventListener('click', () => this.showItemDetails(item));

        row.appendChild(nameCell);
        row.appendChild(addedCell);
        row.appendChild(priceCell);
        row.appendChild(propertiesCell);
        row.appendChild(townCell);
        row.appendChild(shopCell);

        return row;
    }

    createPropertiesElement(item) {
        return BodegaShared.createPropertiesElement(item);
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return '< 1m';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${diffDays}d`;
    }

    formatPrice(price) {
        return DataLoader.formatPrice(price);
    }

    displayNoResults() {
        const tbody = document.getElementById('results-body');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-results">
                    No added items match these filters
                </td>
            </tr>
        `;
    }

    showItemDetails(item) {
        // Use existing modal functionality from search engine
        if (window.searchEngine && window.searchEngine.showItemDetails) {
            window.searchEngine.showItemDetails(item);
        }
    }

    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        BodegaShared.renderPagination(this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.displayResults();
            this.updateResultsHeader();
        });
    }

    updateResultsHeader() {
        const totalItems = this.filteredItems.length;
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.itemsPerPage, totalItems);

        document.getElementById('results-count').textContent = `${totalItems} recently added items found`;

        if (totalItems > 0) {
            document.getElementById('page-info').textContent = `Showing ${startIndex}-${endIndex} of ${totalItems}`;
        } else {
            document.getElementById('page-info').textContent = '';
        }
    }

    isActiveMode() {
        const addedMode = document.getElementById('added-mode');
        return addedMode && addedMode.style.display !== 'none';
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.displayResults();
            this.updateResultsHeader();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.displayResults();
            this.updateResultsHeader();
        }
    }

    clearSearch() {
        document.getElementById('added-search-input').value = '';
        this.performSearch();
    }

    resetFilters() {
        document.getElementById('added-search-input').value = '';
        document.getElementById('added-date-filter').selectedIndex = 0;
        document.getElementById('added-price-filter').selectedIndex = 0;
        document.getElementById('added-town-filter').selectedIndex = 0;

        this.currentSort = { field: 'addedDate', direction: 'desc' };
        this.updateSortIndicators();
        this.performSearch();
    }

    navigateToShopInBrowse(townName, shopName) {
        // Switch to browse tab
        if (window.browseEngine) {
            window.browseEngine.switchToBrowse();

            // Wait for browse mode to initialize then select the town and shop
            setTimeout(() => {
                // Select the town in the dropdown
                const townSelect = document.getElementById('browse-town-select');
                if (townSelect) {
                    townSelect.value = townName;
                    window.browseEngine.selectTown(townName);

                    // Select the specific shop after town is loaded
                    setTimeout(() => {
                        window.browseEngine.selectShop(townName, shopName);
                    }, 100);
                }
            }, 100);
        }
    }
}

// Initialize added engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.addedEngine = new AddedEngine();
});

