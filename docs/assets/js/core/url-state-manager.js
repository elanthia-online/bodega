/**
 * URL State Manager
 * Handles URL synchronization for search, browse, added, and removed modes
 */
class URLStateManager {
    constructor() {
        this.suppressUpdates = false;
        this.initializePopStateHandler();
    }

    initializePopStateHandler() {
        window.addEventListener('popstate', () => {
            this.restoreStateFromURL();
        });
    }

    getCurrentParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    }

    getCurrentMode() {
        const params = this.getCurrentParams();

        // Legacy support for item detail links
        if (params.item && params.shop && params.town) {
            return 'item-detail';
        }

        // Legacy support for hash-based browse mode
        if (window.location.hash && window.location.hash.startsWith('#browse/')) {
            return 'browse';
        }

        return params.mode || 'search';
    }

    restoreStateFromURL() {
        this.suppressUpdates = true;

        try {
            const mode = this.getCurrentMode();
            const params = this.getCurrentParams();

            switch (mode) {
                case 'search':
                    this.restoreSearchState(params);
                    break;
                case 'browse':
                    this.restoreBrowseState(params);
                    break;
                case 'added':
                    this.restoreAddedState(params);
                    break;
                case 'removed':
                    this.restoreRemovedState(params);
                    break;
                case 'item-detail':
                    this.restoreItemDetailState(params);
                    break;
                default:
                    this.restoreSearchState(params);
            }
        } finally {
            setTimeout(() => {
                this.suppressUpdates = false;
            }, 100);
        }
    }

    restoreSearchState(params) {
        if (!window.searchEngine) return;

        // Switch to search tab
        document.getElementById('search-tab')?.click();

        // Restore search query
        if (params.q) {
            document.getElementById('search-input').value = decodeURIComponent(params.q);
        }

        // Restore field checkboxes
        if (params.fields) {
            const fields = params.fields.split(',');
            document.getElementById('search-field-name').checked = fields.includes('name');
            document.getElementById('search-field-properties').checked = fields.includes('properties');
            document.getElementById('search-shop-signs').checked = fields.includes('signs');
        }

        // Restore multi-select filters
        if (params.town) {
            this.restoreMultiSelectFilter('town', params.town);
        }
        if (params.price) {
            this.restoreMultiSelectFilter('price', params.price);
        }
        if (params.itemType) {
            this.restoreMultiSelectFilter('itemType', params.itemType);
        }
        if (params.enchant) {
            this.restoreMultiSelectFilter('enchant', params.enchant);
        }
        if (params.capacity) {
            this.restoreMultiSelectFilter('capacity', params.capacity);
        }
        if (params.armorType) {
            this.restoreMultiSelectFilter('armorType', params.armorType);
        }
        if (params.shieldType) {
            this.restoreMultiSelectFilter('shieldType', params.shieldType);
        }
        if (params.wearLocation) {
            this.restoreMultiSelectFilter('wearLocation', params.wearLocation);
        }
        if (params.skill) {
            this.restoreMultiSelectFilter('skill', params.skill);
        }
        if (params.specialProps) {
            this.restoreMultiSelectFilter('specialProperties', params.specialProps);
        }
        if (params.gemstone) {
            this.restoreMultiSelectFilter('gemstone', params.gemstone);
        }

        // Restore sort
        if (params.sort) {
            window.searchEngine.currentSort.field = params.sort;
            window.searchEngine.currentSort.direction = params.dir || 'asc';
        }

        // Restore page
        if (params.page) {
            window.searchEngine.currentPage = parseInt(params.page) || 1;
        }

        // Perform search
        window.searchEngine.performSearch();
    }

    restoreMultiSelectFilter(filterName, paramValue) {
        if (!paramValue) return;

        const values = paramValue.split(',').map(v => decodeURIComponent(v));
        const filter = window.searchEngine.multiSelectFilters[filterName];

        if (!filter) return;

        values.forEach(value => {
            const select = filter.select;
            const option = Array.from(select.options).find(opt => opt.value === value);
            if (option) {
                filter.addSelection(value, option.text);
            }
        });
    }

    restoreBrowseState(params) {
        if (!window.browseEngine) return;

        // Switch to browse tab
        document.getElementById('browse-tab')?.click();

        // Handle legacy hash-based navigation
        if (window.location.hash && window.location.hash.startsWith('#browse/')) {
            window.browseEngine.handleHashChange();
            return;
        }

        // Restore town and shop selection
        if (params.town) {
            const townName = decodeURIComponent(params.town);

            if (params.shop) {
                const shopName = decodeURIComponent(params.shop);
                setTimeout(() => {
                    window.browseEngine.switchToBrowseAndSelectShop(townName, shopName);
                }, 100);
            } else {
                window.browseEngine.selectTown(townName);
            }
        }
    }

    restoreAddedState(params) {
        if (!window.addedEngine) return;

        document.getElementById('added-tab')?.click();

        if (params.days) {
            const filter = document.getElementById('added-date-filter');
            if (filter) filter.value = params.days;
        }

        if (params.q) {
            const input = document.getElementById('added-search-input');
            if (input) input.value = decodeURIComponent(params.q);
        }

        if (params.town) {
            const filter = document.getElementById('added-town-filter');
            if (filter) filter.value = decodeURIComponent(params.town);
        }

        if (params.price) {
            const filter = document.getElementById('added-price-filter');
            if (filter) filter.value = params.price;
        }

        window.addedEngine.performSearch?.();
    }

    restoreRemovedState(params) {
        if (!window.removedEngine) return;

        document.getElementById('removed-tab')?.click();

        if (params.days) {
            const filter = document.getElementById('removed-date-filter');
            if (filter) filter.value = params.days;
        }

        if (params.q) {
            const input = document.getElementById('removed-search-input');
            if (input) input.value = decodeURIComponent(params.q);
        }

        if (params.price) {
            const filter = document.getElementById('removed-price-filter');
            if (filter) filter.value = params.price;
        }

        window.removedEngine.performSearch?.();
    }

    restoreItemDetailState(params) {
        if (!window.searchEngine) return;
        window.searchEngine.findAndShowItemFromURL(
            params.item,
            params.shop,
            params.town
        );
    }

    updateSearchURL(state) {
        if (this.suppressUpdates) return;

        const params = new URLSearchParams();
        params.set('mode', 'search');

        if (state.query) params.set('q', state.query);

        // Field filters
        const fields = [];
        if (state.searchFieldName) fields.push('name');
        if (state.searchFieldProperties) fields.push('properties');
        if (state.searchShopSigns) fields.push('signs');
        if (fields.length > 0) params.set('fields', fields.join(','));

        // Multi-select filters
        if (state.towns?.length > 0) params.set('town', state.towns.join(','));
        if (state.priceRanges?.length > 0) params.set('price', state.priceRanges.join(','));
        if (state.itemTypes?.length > 0) params.set('itemType', state.itemTypes.join(','));
        if (state.enchantLevels?.length > 0) params.set('enchant', state.enchantLevels.join(','));
        if (state.capacityLevels?.length > 0) params.set('capacity', state.capacityLevels.join(','));
        if (state.armorTypes?.length > 0) params.set('armorType', state.armorTypes.join(','));
        if (state.shieldTypes?.length > 0) params.set('shieldType', state.shieldTypes.join(','));
        if (state.wearLocations?.length > 0) params.set('wearLocation', state.wearLocations.join(','));
        if (state.skills?.length > 0) params.set('skill', state.skills.join(','));
        if (state.specialProperties?.length > 0) params.set('specialProps', state.specialProperties.join(','));
        if (state.gemstones?.length > 0) params.set('gemstone', state.gemstones.join(','));

        // Sort
        if (state.sortField && state.sortField !== 'name') {
            params.set('sort', state.sortField);
            params.set('dir', state.sortDirection || 'asc');
        }

        // Page
        if (state.page && state.page > 1) {
            params.set('page', state.page);
        }

        this.updateURL(params);
    }

    updateBrowseURL(state) {
        if (this.suppressUpdates) return;

        const params = new URLSearchParams();
        params.set('mode', 'browse');

        if (state.town) params.set('town', state.town);
        if (state.shop) params.set('shop', state.shop);

        this.updateURL(params);
    }

    updateAddedURL(state) {
        if (this.suppressUpdates) return;

        const params = new URLSearchParams();
        params.set('mode', 'added');

        if (state.days) params.set('days', state.days);
        if (state.query) params.set('q', state.query);
        if (state.town) params.set('town', state.town);
        if (state.priceRange) params.set('price', state.priceRange);

        this.updateURL(params);
    }

    updateRemovedURL(state) {
        if (this.suppressUpdates) return;

        const params = new URLSearchParams();
        params.set('mode', 'removed');

        if (state.days) params.set('days', state.days);
        if (state.query) params.set('q', state.query);
        if (state.priceRange) params.set('price', state.priceRange);

        this.updateURL(params);
    }

    updateURL(params) {
        const url = params.toString();
        // Always include pathname to ensure we clear any existing hash
        const newURL = url ? `${window.location.pathname}?${url}` : window.location.pathname;

        if (newURL.length > 1500) {
            console.warn('URL too long:', newURL.length, 'chars');
        }

        // Compare full path+search+hash to determine if update is needed
        const currentURL = window.location.pathname + window.location.search + window.location.hash;
        if (currentURL !== newURL) {
            // Use replaceState to ensure hash is cleared (pushState can be unreliable for hash clearing)
            window.history.replaceState({ timestamp: Date.now() }, '', newURL);
        }
    }
}

// Initialize global URL state manager
window.urlStateManager = new URLStateManager();

// Restore state on page load
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('dataLoaded', () => {
        setTimeout(() => {
            window.urlStateManager.restoreStateFromURL();
        }, 200);
    });
});
