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

        // Sort control
        document.getElementById('added-sort-filter').addEventListener('change', (e) => {
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

    switchToAdded() {
        document.getElementById('search-tab').classList.remove('active');
        document.getElementById('browse-tab').classList.remove('active');
        document.getElementById('removed-tab').classList.remove('active');
        document.getElementById('added-tab').classList.add('active');

        document.getElementById('search-mode').style.display = 'none';
        document.getElementById('browse-mode').style.display = 'none';
        document.getElementById('removed-mode').style.display = 'none';
        document.getElementById('added-mode').style.display = 'block';

        // Hide pagination controls for added mode
        document.getElementById('pagination').style.display = 'none';

        // Initialize added data if not done yet
        if (this.addedItems.length === 0) {
            this.initializeAddedData();
        } else {
            this.performSearch();
        }
    }

    initializeAddedData() {
        if (!window.dataLoader || !window.dataLoader.addedItems) {
            console.log('No added items data available');
            this.displayNoResults();
            return;
        }

        this.addedItems = window.dataLoader.addedItems;
        console.log(`Loaded ${this.addedItems.length} added items`);

        // Populate town filter
        this.populateTownFilter();

        this.performSearch();
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
        this.displayResults();
        this.updateResultsHeader();
    }

    getFilters() {
        return {
            search: document.getElementById('added-search-input').value.trim(),
            days: document.getElementById('added-date-filter').value,
            priceRange: document.getElementById('added-price-filter').value,
            town: document.getElementById('added-town-filter').value,
            sort: document.getElementById('added-sort-filter').value
        };
    }

    matchesAllFilters(item, filters) {
        // Search text filter
        if (filters.search && !this.matchesSearchText(item.searchText || item.name, filters.search)) {
            return false;
        }

        // Days filter (only show items added within the timeframe)
        if (filters.days) {
            const daysAgo = parseInt(filters.days);
            const addedDate = new Date(item.addedDate);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

            if (addedDate < cutoffDate) {
                return false;
            }
        } else {
            // Default to last 24 hours if no filter selected
            const addedDate = new Date(item.addedDate);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 1);

            if (addedDate < cutoffDate) {
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

    setSortOrder(sortValue) {
        const sortMap = {
            'added-desc': { field: 'addedDate', direction: 'desc' },
            'added-asc': { field: 'addedDate', direction: 'asc' },
            'name': { field: 'name', direction: 'asc' },
            'price-asc': { field: 'price', direction: 'asc' },
            'price-desc': { field: 'price', direction: 'desc' },
            'enchant-desc': { field: 'enchant', direction: 'desc' },
            'town': { field: 'town', direction: 'asc' },
            'type': { field: 'itemType', direction: 'asc' }
        };

        this.currentSort = sortMap[sortValue] || { field: 'addedDate', direction: 'desc' };
    }

    sortItems() {
        this.filteredItems.sort((a, b) => {
            let aValue = a[this.currentSort.field];
            let bValue = b[this.currentSort.field];

            // Handle dates
            if (this.currentSort.field === 'addedDate') {
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
            const row = this.createAddedItemRow(item);
            tbody.appendChild(row);
        });
    }

    createAddedItemRow(item) {
        const row = document.createElement('tr');
        row.className = 'item-row added-item';

        const addedDate = new Date(item.addedDate);
        const properties = this.createPropertiesElement(item);

        row.innerHTML = `
            <td class="item-name">
                <span class="name">${item.name}</span>
                ${item.enchant > 0 ? `<span class="enchant">+${item.enchant}</span>` : ''}
                <div class="added-info">
                    Added ${this.formatRelativeTime(addedDate)}
                </div>
            </td>
            <td class="item-price">${this.formatPrice(item.price)}</td>
            <td class="item-properties">${properties.innerHTML}</td>
            <td class="item-town">${item.town || 'Unknown'}</td>
            <td class="item-shop">${item.room || item.shop || 'Unknown'}</td>
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
                    No recently added items found in the last 24 hours
                </td>
            </tr>
        `;
    }

    updateResultsHeader() {
        const resultsCount = document.getElementById('results-count');
        const pageInfo = document.getElementById('page-info');

        resultsCount.textContent = `${this.filteredItems.length} recently added items found`;
        pageInfo.textContent = '';
    }

    showItemDetails(item) {
        // Use existing modal functionality from search engine
        if (window.searchEngine && window.searchEngine.showItemDetails) {
            window.searchEngine.showItemDetails(item);
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
        document.getElementById('added-sort-filter').selectedIndex = 0;

        this.currentSort = { field: 'addedDate', direction: 'desc' };
        this.performSearch();
    }
}

// Initialize added engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.addedEngine = new AddedEngine();
});

// Initialize added data when main data is loaded
window.addEventListener('dataLoaded', () => {
    if (window.addedEngine) {
        window.addedEngine.initializeAddedData();
    }
});