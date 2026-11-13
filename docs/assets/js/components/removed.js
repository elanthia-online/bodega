// Recently Removed Items System
class RemovedEngine {
    constructor() {
        this.removedItems = [];
        this.filteredItems = [];
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.currentSort = { field: 'removedDate', direction: 'desc' };

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Tab switching
        document.getElementById('removed-tab').addEventListener('click', () => this.switchToRemoved());

        // Search controls
        document.getElementById('removed-search-input').addEventListener('input', this.debounce(() => {
            this.performSearch();
        }, 300));

        document.getElementById('removed-search-btn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('removed-clear-btn').addEventListener('click', () => {
            this.clearSearch();
        });

        // Filter controls
        document.getElementById('removed-apply-filters').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('removed-reset-filters').addEventListener('click', () => {
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
            <th class="sortable" data-sort="removed" scope="col"><button type="button" class="sort-button">Removed<span class="sort-indicator" aria-hidden="true"></span></button></th>
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

    switchToRemoved() {
        BodegaShared.activateMode('removed');

        // Show pagination controls for removed mode
        document.getElementById('pagination').style.display = 'flex';
        document.getElementById('pagination-top').style.display = 'flex';

        // Hide browse sort mode toggle
        const sortModeToggle = document.getElementById('browse-sort-mode-toggle');
        if (sortModeToggle) sortModeToggle.style.display = 'none';

        // Show and update table headers for removed mode
        const tableHead = document.querySelector('#results-table thead');
        if (tableHead) tableHead.style.display = '';
        this.updateTableHeaders();
        this.updateSortIndicators();

        // Load removed data on first use, then search
        this.initializeRemovedData();

        // Update URL to removed mode
        if (window.urlStateManager) {
            this.updateURLState();
        }
    }

    // removed_items.json is fetched the first time this tab is opened
    // (not at page load), so show a loading row until it arrives.
    async initializeRemovedData() {
        if (!this.dataReady) {
            this.showLoadingRow();
            try {
                this.removedItems = await window.dataLoader.ensureRemovedItems();
            } catch (error) {
                console.error('Failed to load removed items:', error);
                this.removedItems = [];
            }
            // An empty result usually means the fetch failed; retry next time
            this.dataReady = this.removedItems.length > 0;
        }

        // The user may have switched tabs while the data was loading
        if (!this.isActiveMode()) return;
        this.performSearch();
    }

    showLoadingRow() {
        if (!this.isActiveMode()) return;
        document.getElementById('results-body').innerHTML =
            '<tr><td colspan="6" class="no-results">Loading removed items…</td></tr>';
        document.getElementById('results-count').textContent = 'Loading removed items…';
        document.getElementById('page-info').textContent = '';
        BodegaShared.renderPagination(1, 0, () => {});
    }

    performSearch() {
        const filters = this.getFilters();
        this.filteredItems = this.removedItems.filter(item => this.matchesAllFilters(item, filters));

        this.sortItems();
        this.currentPage = 1; // Reset to first page when searching
        this.displayResults();
        this.updateResultsHeader();
        this.updateURLState();
    }

    updateURLState() {
        if (!window.urlStateManager) return;
        // Only update URL if removed tab is actually active
        if (!this.isActiveMode()) return;

        window.urlStateManager.updateRemovedURL({
            days: document.getElementById('removed-date-filter')?.value,
            query: document.getElementById('removed-search-input')?.value,
            priceRange: document.getElementById('removed-price-filter')?.value
        });
    }

    getFilters() {
        return {
            search: document.getElementById('removed-search-input').value.trim(),
            days: document.getElementById('removed-date-filter').value,
            priceRange: document.getElementById('removed-price-filter').value
        };
    }

    matchesAllFilters(item, filters) {
        // Search text filter
        if (filters.search && !this.matchesSearchText(item.searchText || item.name, filters.search)) {
            return false;
        }

        // Days filter
        if (filters.days) {
            const daysAgo = parseInt(filters.days);
            const removedDate = new Date(item.removedDate);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

            if (removedDate < cutoffDate) {
                return false;
            }
        }

        // Price range filter
        if (filters.priceRange) {
            const [min, max] = filters.priceRange.split('-').map(Number);
            // Null-priced (free/unpriced) items only match when the range
            // starts at 0; otherwise a null price must not coerce to 0.
            const price = item.price !== null && item.price !== undefined ? item.price : (min === 0 ? 0 : NaN);
            if (price < min || price > max) {
                return false;
            }
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
        if (field === 'removed') sortField = 'removedDate';
        if (field === 'shop') sortField = 'lastSeenShop';
        if (field === 'town') sortField = 'lastSeenTown';
        if (field === 'properties') sortField = 'propertyCount';

        // Toggle direction if clicking same field, otherwise default appropriately
        if (this.currentSort.field === sortField) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Default: price asc, removed desc (newest first), property count desc, others asc
            const defaultDirection = (sortField === 'removedDate' || sortField === 'propertyCount') ? 'desc' : (sortField === 'price' ? 'asc' : 'asc');
            this.currentSort = { field: sortField, direction: defaultDirection };
        }

        this.updateSortIndicators();
        this.performSearch();
    }

    updateSortIndicators() {
        // Map internal field names back to header data-sort values
        let headerField = this.currentSort.field;
        if (this.currentSort.field === 'removedDate') headerField = 'removed';
        if (this.currentSort.field === 'lastSeenShop') headerField = 'shop';
        if (this.currentSort.field === 'lastSeenTown') headerField = 'town';
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
                if (this.currentSort.field === 'removedDate') {
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
            const row = this.createRemovedItemRow(item);
            tbody.appendChild(row);
        });

        this.updatePagination(totalItems);
    }

    createRemovedItemRow(item) {
        const row = document.createElement('tr');
        row.className = 'item-row removed-item';

        const removedDate = new Date(item.removedDate);
        const properties = this.createPropertiesElement(item);

        // Build cells with textContent — item/shop names are player-controlled
        const nameCell = document.createElement('td');
        nameCell.className = 'item-name';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = item.name;
        BodegaShared.makeActivatable(nameSpan);
        nameCell.appendChild(nameSpan);

        // Add quantity after name if it exists (with 2 spaces, not underlined)
        if (item.quantity) {
            nameCell.appendChild(document.createTextNode(`  (${item.quantity})`));
        }

        const timeCell = document.createElement('td');
        timeCell.className = 'item-removed-time';
        timeCell.textContent = this.formatRelativeTime(removedDate);

        const priceCell = document.createElement('td');
        priceCell.className = 'item-price';
        priceCell.textContent = this.formatPrice(item.price);

        const propertiesCell = document.createElement('td');
        propertiesCell.className = 'item-properties';
        propertiesCell.appendChild(properties);

        const townCell = document.createElement('td');
        townCell.className = 'item-town';
        townCell.textContent = item.lastSeenTown || 'Unknown';

        const shopCell = document.createElement('td');
        shopCell.className = 'item-shop';
        shopCell.textContent = item.lastSeenShop || 'Unknown';

        row.append(nameCell, timeCell, priceCell, propertiesCell, townCell, shopCell);

        // Register for hover tooltip (raw recall preview)
        if (window.tooltipManager && nameSpan) {
            window.tooltipManager.register(nameSpan, item);
        }

        // Add click handler for item details
        row.addEventListener('click', () => this.showItemDetails(item));

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
                    No removed items found matching your criteria
                </td>
            </tr>
        `;
    }

    isActiveMode() {
        const removedMode = document.getElementById('removed-mode');
        return removedMode && removedMode.style.display !== 'none';
    }

    showItemDetails(item) {
        // Get shop location from the owner index built from current town data
        // (empty if the shop no longer exists). The index uses owner names
        // (e.g., "Painz") not full names (e.g., "Painz's Magic Shoppe").
        const ownerName = this.extractOwnerNameFromShopName(item.lastSeenShop);
        const loc = window.dataLoader?.ownerLocationIndex?.[ownerName] || {};
        const shopExterior = loc.exterior || '';

        // Create a normalized item object for the modal
        const normalizedItem = {
            ...item,
            shopName: item.lastSeenShop || 'Unknown Shop',
            town: item.lastSeenTown || item.town || 'Unknown'
        };

        // Explicitly set room and shopLocation after spread to ensure it overrides any existing properties
        normalizedItem.room = shopExterior || '';
        normalizedItem.shopLocation = shopExterior || '';
        normalizedItem.shopRoomNumber = loc.roomNumber || null;
        normalizedItem.shopRoomName = loc.roomName || null;

        // Use existing modal functionality from search engine with normalized data
        if (window.searchEngine && window.searchEngine.showItemDetails) {
            window.searchEngine.showItemDetails(normalizedItem);
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

        document.getElementById('results-count').textContent = `${totalItems} removed items found`;

        if (totalItems > 0) {
            document.getElementById('page-info').textContent = `Showing ${startIndex}-${endIndex} of ${totalItems}`;
        } else {
            document.getElementById('page-info').textContent = '';
        }
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
        document.getElementById('removed-search-input').value = '';
        this.performSearch();
    }

    extractOwnerNameFromShopName(shopName) {
        return BodegaShared.extractOwnerNameFromShopName(shopName);
    }

    resetFilters() {
        document.getElementById('removed-search-input').value = '';
        document.getElementById('removed-date-filter').selectedIndex = 0;
        document.getElementById('removed-price-filter').selectedIndex = 0;

        this.currentSort = { field: 'removedDate', direction: 'desc' };
        this.updateSortIndicators();
        this.performSearch();
    }
}

// Initialize removed engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.removedEngine = new RemovedEngine();
});

