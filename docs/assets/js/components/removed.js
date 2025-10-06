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
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    updateTableHeaders() {
        const thead = document.querySelector('#results-table thead tr');
        thead.innerHTML = `
            <th class="sortable" data-sort="name">Item Name <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="removed">Removed <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="price">Price <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="properties">Properties <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="town">Town <span class="sort-indicator"></span></th>
            <th class="sortable" data-sort="shop">Shop <span class="sort-indicator"></span></th>
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
        document.getElementById('search-tab').classList.remove('active');
        document.getElementById('browse-tab').classList.remove('active');
        document.getElementById('added-tab').classList.remove('active');
        document.getElementById('removed-tab').classList.add('active');

        document.getElementById('search-mode').style.display = 'none';
        document.getElementById('browse-mode').style.display = 'none';
        document.getElementById('added-mode').style.display = 'none';
        document.getElementById('removed-mode').style.display = 'block';

        // Show pagination controls for removed mode
        document.getElementById('pagination').style.display = 'flex';
        document.getElementById('pagination-top').style.display = 'flex';

        // Show and update table headers for removed mode
        const tableHead = document.querySelector('#results-table thead');
        if (tableHead) tableHead.style.display = '';
        this.updateTableHeaders();
        this.updateSortIndicators();

        // Initialize removed data if not done yet
        if (this.removedItems.length === 0) {
            this.initializeRemovedData();
        } else {
            this.performSearch();
        }
    }

    initializeRemovedData() {
        if (!window.dataLoader || !window.dataLoader.removedItems) {
            console.log('No removed items data available');
            this.displayNoResults();
            return;
        }

        this.removedItems = window.dataLoader.removedItems;
        console.log(`Loaded ${this.removedItems.length} removed items`);
        this.performSearch();
    }

    performSearch() {
        const filters = this.getFilters();
        this.filteredItems = this.removedItems.filter(item => this.matchesAllFilters(item, filters));

        this.sortItems();
        this.currentPage = 1; // Reset to first page when searching
        this.displayResults();
        this.updateResultsHeader();
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
            if (item.price < min || item.price > max) {
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
        // Clear all indicators
        document.querySelectorAll('#results-table th.sortable .sort-indicator').forEach(indicator => {
            indicator.textContent = '';
        });

        // Map internal field names back to header data-sort values
        let headerField = this.currentSort.field;
        if (this.currentSort.field === 'removedDate') headerField = 'removed';
        if (this.currentSort.field === 'lastSeenShop') headerField = 'shop';
        if (this.currentSort.field === 'lastSeenTown') headerField = 'town';
        if (this.currentSort.field === 'propertyCount') headerField = 'properties';

        // Set indicator for current sort
        const currentHeader = document.querySelector(`#results-table th[data-sort="${headerField}"]`);
        if (currentHeader) {
            const indicator = currentHeader.querySelector('.sort-indicator');
            indicator.textContent = this.currentSort.direction === 'asc' ? ' ↑' : ' ↓';
        }
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
        // Only count enhancive properties (green stat bonuses)
        // Note: the property is called "enhancives" (plural)
        if (item.enhancives && item.enhancives.length > 0) {
            return item.enhancives.length;
        }
        return 0;
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

        row.innerHTML = `
            <td class="item-name">
                <span class="name">${item.name}</span>
                ${item.enchant > 0 ? `<span class="enchant">+${item.enchant}</span>` : ''}
            </td>
            <td class="item-removed-time">${this.formatRelativeTime(removedDate)}</td>
            <td class="item-price">${this.formatPrice(item.price)}</td>
            <td class="item-properties">${properties.innerHTML}</td>
            <td class="item-town">${item.lastSeenTown || 'Unknown'}</td>
            <td class="item-shop">${item.lastSeenShop || 'Unknown'}</td>
        `;

        // Add click handler for item details
        row.addEventListener('click', () => this.showItemDetails(item));

        return row;
    }

    createPropertiesElement(item) {
        // Use the same property element creation as search engine
        const container = document.createElement('div');

        // Basic tags
        if (item.itemType) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1);
            container.appendChild(tag);
        }

        if (item.enchant) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = `+${item.enchant}`;
            container.appendChild(tag);
        }

        // Add enhancives
        if (item.enhancives && item.enhancives.length > 0) {
            item.enhancives.forEach(enh => {
                const tag = document.createElement('span');
                tag.className = 'property-tag enhancive';
                tag.textContent = `+${enh.boost} ${enh.ability}`;
                container.appendChild(tag);
            });
        }

        return container;
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
        if (price >= 1000000) {
            return (price / 1000000).toFixed(1) + 'M';
        } else if (price >= 1000) {
            return (price / 1000).toFixed(1) + 'k';
        }
        return price.toString();
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

    updateResultsHeader() {
        const resultsCount = document.getElementById('results-count');
        const pageInfo = document.getElementById('page-info');

        resultsCount.textContent = `${this.filteredItems.length} removed items found`;
        pageInfo.textContent = '';
    }

    isActiveMode() {
        const removedMode = document.getElementById('removed-mode');
        return removedMode && removedMode.style.display !== 'none';
    }

    showItemDetails(item) {
        // Get shop exterior description from shop mapping if available
        const shopMapping = window.dataLoader && window.dataLoader.shopMapping ? window.dataLoader.shopMapping : {};
        const shopExterior = shopMapping[item.lastSeenShop]?.exterior || '';

        // Debug logging to see what's happening
        console.log('Shop mapping debug:', {
            hasDataLoader: !!window.dataLoader,
            hasShopMapping: !!(window.dataLoader && window.dataLoader.shopMapping),
            shopMappingKeys: shopMapping ? Object.keys(shopMapping).length : 0,
            lookingForShop: item.lastSeenShop,
            foundExterior: shopExterior
        });

        // Create a normalized item object for the modal
        const normalizedItem = {
            ...item,
            shopName: item.lastSeenShop || 'Unknown Shop',
            town: item.lastSeenTown || item.town || 'Unknown'
        };

        // Explicitly set room and shopLocation after spread to ensure it overrides any existing properties
        normalizedItem.room = shopExterior || '';
        normalizedItem.shopLocation = shopExterior || '';

        // Debug the actual normalized item values
        console.log('Normalized item debug:', {
            shopExterior: shopExterior,
            roomValue: normalizedItem.room,
            shopLocationValue: normalizedItem.shopLocation,
            originalItemRoom: item.room
        });

        // Use existing modal functionality from search engine with normalized data
        if (window.searchEngine && window.searchEngine.showItemDetails) {
            window.searchEngine.showItemDetails(normalizedItem);
        }
    }

    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);

        // Update pagination controls
        document.getElementById('prev-page').disabled = this.currentPage <= 1;
        document.getElementById('next-page').disabled = this.currentPage >= totalPages;
        document.getElementById('prev-page-top').disabled = this.currentPage <= 1;
        document.getElementById('next-page-top').disabled = this.currentPage >= totalPages;

        const pageNumbers = document.getElementById('page-numbers');
        const pageNumbersTop = document.getElementById('page-numbers-top');
        pageNumbers.innerHTML = '';
        pageNumbersTop.innerHTML = '';

        if (totalPages <= 1) return;

        // Generate page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('span');
            pageBtn.className = 'page-number';
            pageBtn.textContent = i;

            const pageBtnTop = document.createElement('span');
            pageBtnTop.className = 'page-number';
            pageBtnTop.textContent = i;

            if (i === this.currentPage) {
                pageBtn.classList.add('current');
                pageBtnTop.classList.add('current');
            } else {
                const clickHandler = () => {
                    this.currentPage = i;
                    this.displayResults();
                };
                pageBtn.addEventListener('click', clickHandler);
                pageBtnTop.addEventListener('click', clickHandler);
            }

            pageNumbers.appendChild(pageBtn);
            pageNumbersTop.appendChild(pageBtnTop);
        }
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
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.displayResults();
        }
    }

    clearSearch() {
        document.getElementById('removed-search-input').value = '';
        this.performSearch();
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

// Initialize removed data when main data is loaded
window.addEventListener('dataLoaded', () => {
    if (window.removedEngine) {
        window.removedEngine.initializeRemovedData();
    }
});