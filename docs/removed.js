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

        // Sort control
        document.getElementById('removed-sort-filter').addEventListener('change', (e) => {
            this.setSortOrder(e.target.value);
            this.performSearch();
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

    switchToRemoved() {
        document.getElementById('search-tab').classList.remove('active');
        document.getElementById('browse-tab').classList.remove('active');
        document.getElementById('added-tab').classList.remove('active');
        document.getElementById('removed-tab').classList.add('active');

        document.getElementById('search-mode').style.display = 'none';
        document.getElementById('browse-mode').style.display = 'none';
        document.getElementById('added-mode').style.display = 'none';
        document.getElementById('removed-mode').style.display = 'block';

        // Hide pagination controls for removed mode
        document.getElementById('pagination').style.display = 'none';

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
        this.displayResults();
        this.updateResultsHeader();
    }

    getFilters() {
        return {
            search: document.getElementById('removed-search-input').value.trim(),
            days: document.getElementById('removed-date-filter').value,
            priceRange: document.getElementById('removed-price-filter').value,
            sort: document.getElementById('removed-sort-filter').value
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

    setSortOrder(sortValue) {
        const sortMap = {
            'removed-desc': { field: 'removedDate', direction: 'desc' },
            'removed-asc': { field: 'removedDate', direction: 'asc' },
            'name': { field: 'name', direction: 'asc' },
            'price-asc': { field: 'price', direction: 'asc' },
            'price-desc': { field: 'price', direction: 'desc' },
            'enchant-desc': { field: 'enchant', direction: 'desc' },
            'town': { field: 'lastSeenTown', direction: 'asc' },
            'type': { field: 'itemType', direction: 'asc' }
        };

        this.currentSort = sortMap[sortValue] || { field: 'removedDate', direction: 'desc' };
    }

    sortItems() {
        this.filteredItems.sort((a, b) => {
            let aValue = a[this.currentSort.field];
            let bValue = b[this.currentSort.field];

            // Handle dates
            if (this.currentSort.field === 'removedDate') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            // Handle nulls
            if (aValue === null || aValue === undefined) aValue = '';
            if (bValue === null || bValue === undefined) bValue = '';

            if (this.currentSort.direction === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }

    displayResults() {
        const tbody = document.getElementById('results-body');
        tbody.innerHTML = '';

        if (this.filteredItems.length === 0) {
            this.displayNoResults();
            return;
        }

        this.filteredItems.forEach(item => {
            const row = this.createRemovedItemRow(item);
            tbody.appendChild(row);
        });
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
                <div class="removed-info">
                    Removed ${this.formatRelativeTime(removedDate)}
                    ${item.lastSeenShop ? ` from ${item.lastSeenShop}` : ''}
                </div>
            </td>
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
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return 'less than an hour ago';
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'yesterday';
        return `${diffDays} days ago`;
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
                <td colspan="5" class="no-results">
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

    clearSearch() {
        document.getElementById('removed-search-input').value = '';
        this.performSearch();
    }

    resetFilters() {
        document.getElementById('removed-search-input').value = '';
        document.getElementById('removed-date-filter').selectedIndex = 0;
        document.getElementById('removed-price-filter').selectedIndex = 0;
        document.getElementById('removed-sort-filter').selectedIndex = 0;

        this.currentSort = { field: 'removedDate', direction: 'desc' };
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