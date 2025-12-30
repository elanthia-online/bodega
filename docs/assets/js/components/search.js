// Multi-select filter management
class MultiSelectFilter {
    constructor(selectId, tagContainerId) {
        this.select = document.getElementById(selectId);
        this.tagContainer = document.getElementById(tagContainerId);
        this.selectedValues = new Set();

        if (!this.select || !this.tagContainer) return;

        this.initializeEvents();
    }

    initializeEvents() {
        this.select.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value && value !== '') {
                this.addSelection(value, e.target.options[e.target.selectedIndex].text);
                // Reset to placeholder
                this.select.selectedIndex = 0;
            }
        });
    }

    addSelection(value, label) {
        if (this.selectedValues.has(value)) return;

        this.selectedValues.add(value);

        const tag = document.createElement('span');
        tag.className = 'filter-tag';
        tag.dataset.value = value;
        tag.innerHTML = `${label} <span class="remove">×</span>`;

        tag.addEventListener('click', () => {
            this.removeSelection(value);
            if (window.searchEngine) {
                window.searchEngine.performSearch();
            }
        });

        this.tagContainer.appendChild(tag);
    }

    removeSelection(value) {
        this.selectedValues.delete(value);
        const tag = this.tagContainer.querySelector(`[data-value="${value}"]`);
        if (tag) tag.remove();
    }

    getSelectedValues() {
        return Array.from(this.selectedValues);
    }

    clear() {
        this.selectedValues.clear();
        this.tagContainer.innerHTML = '';
    }
}

// Search and Filter System
class SearchEngine {
    constructor() {
        this.filteredItems = [];
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.currentSort = { field: 'name', direction: 'asc' };

        // Initialize multi-select filters
        this.multiSelectFilters = {
            town: new MultiSelectFilter('town-filter', 'town-tags'),
            price: new MultiSelectFilter('price-filter', 'price-tags'),
            itemType: new MultiSelectFilter('item-type-filter', 'item-type-tags'),
            enchant: new MultiSelectFilter('enchant-filter', 'enchant-tags'),
            capacity: new MultiSelectFilter('capacity-filter', 'capacity-tags'),
            armorType: new MultiSelectFilter('armor-type-filter', 'armor-type-tags'),
            shieldType: new MultiSelectFilter('shield-type-filter', 'shield-type-tags'),
            wearLocation: new MultiSelectFilter('wear-location-filter', 'wear-location-tags'),
            skill: new MultiSelectFilter('skill-filter', 'skill-tags'),
            gemstone: new MultiSelectFilter('gemstone-filter', 'gemstone-tags'),
            specialProperties: new MultiSelectFilter('special-properties-filter', 'special-properties-tags')
        };

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', this.debounce(() => {
            this.performSearch();
        }, 300));

        // Search and clear buttons
        document.getElementById('search-btn').addEventListener('click', () => {
            this.performSearch();
            this.updateURLState();
        });

        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearSearch();
        });

        // Field filter checkboxes
        document.getElementById('search-field-name').addEventListener('change', () => {
            this.performSearch();
        });
        document.getElementById('search-field-properties').addEventListener('change', () => {
            this.performSearch();
        });
        document.getElementById('search-shop-signs').addEventListener('change', () => {
            this.performSearch();
        });

        // Filter controls
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.performSearch();
            this.updateURLState();
        });

        document.getElementById('reset-filters').addEventListener('click', () => {
            this.resetFilters();
        });

        // Bottom filter controls (duplicates for mobile)
        document.getElementById('apply-filters-bottom').addEventListener('click', () => {
            this.performSearch();
            this.updateURLState();
        });

        document.getElementById('reset-filters-bottom').addEventListener('click', () => {
            this.resetFilters();
        });

        // Table header sorting
        document.querySelectorAll('#results-table th.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const sortField = header.dataset.sort;
                this.handleHeaderSort(sortField);
            });
        });

        // Pagination - Bottom controls (check if active mode before executing)
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.isActiveMode()) this.previousPage();
        });

        document.getElementById('next-page').addEventListener('click', () => {
            if (this.isActiveMode()) this.nextPage();
        });

        // Pagination - Top controls (check if active mode before executing)
        document.getElementById('prev-page-top').addEventListener('click', () => {
            if (this.isActiveMode()) this.previousPage();
        });

        document.getElementById('next-page-top').addEventListener('click', () => {
            if (this.isActiveMode()) this.nextPage();
        });

        // Modal
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (event) => {
            const modal = document.getElementById('item-modal');
            if (event.target === modal) {
                this.closeModal();
            }
        });

        // Enter key in search
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Search help toggle
        document.getElementById('search-help-toggle').addEventListener('click', () => {
            const content = document.getElementById('search-help-content');
            const icon = document.querySelector('.toggle-icon');

            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.classList.add('expanded');
            } else {
                content.style.display = 'none';
                icon.classList.remove('expanded');
            }
        });
    }

    performSearch() {
        if (!window.dataLoader || !window.dataLoader.allItems) {
            console.log('Data not loaded yet');
            return;
        }

        // Ensure table headers are visible when searching (in case browse mode hid them)
        const tableHead = document.querySelector('#results-table thead');
        if (tableHead) tableHead.style.display = '';

        const allItems = window.dataLoader.allItems;
        const filters = this.getFilters();


        this.filteredItems = allItems.filter(item => {
            return this.matchesAllFilters(item, filters);
        });

        this.sortItems();
        this.updateSortIndicators();
        this.currentPage = 1;
        this.displayResults();
        this.updatePagination();
    }

    updateURLState() {
        if (!window.urlStateManager) return;

        const filters = this.getFilters();

        window.urlStateManager.updateSearchURL({
            query: filters.search,
            searchFieldName: filters.searchFieldName,
            searchFieldProperties: filters.searchFieldProperties,
            searchShopSigns: filters.searchShopSigns,
            towns: filters.towns,
            priceRanges: filters.priceRanges,
            itemTypes: filters.itemTypes,
            enchantLevels: filters.enchantLevels,
            capacityLevels: filters.capacityLevels,
            armorTypes: filters.armorTypes,
            shieldTypes: filters.shieldTypes,
            wearLocations: filters.wearLocations,
            skills: filters.skills,
            specialProperties: filters.specialProperties,
            gemstones: filters.gemstones,
            sortField: this.currentSort.field,
            sortDirection: this.currentSort.direction,
            page: this.currentPage
        });
    }

    getFilters() {
        return {
            search: document.getElementById('search-input').value.toLowerCase().trim(),
            searchShopSigns: document.getElementById('search-shop-signs').checked,
            searchFieldName: document.getElementById('search-field-name').checked,
            searchFieldProperties: document.getElementById('search-field-properties').checked,
            towns: this.multiSelectFilters.town.getSelectedValues(),
            priceRanges: this.multiSelectFilters.price.getSelectedValues(),
            itemTypes: this.multiSelectFilters.itemType.getSelectedValues(),
            enchantLevels: this.multiSelectFilters.enchant.getSelectedValues(),
            capacityLevels: this.multiSelectFilters.capacity.getSelectedValues(),
            armorTypes: this.multiSelectFilters.armorType.getSelectedValues(),
            shieldTypes: this.multiSelectFilters.shieldType.getSelectedValues(),
            wearLocations: this.multiSelectFilters.wearLocation.getSelectedValues(),
            skills: this.multiSelectFilters.skill.getSelectedValues(),
            specialProperties: this.multiSelectFilters.specialProperties.getSelectedValues(),
            gemstones: this.multiSelectFilters.gemstone.getSelectedValues()
        };
    }

    /**
     * Parse advanced search query with OR and NOT operations
     * Returns structured query object or null if no operators
     */
    parseAdvancedQuery(query) {
        if (!query) return null;

        // Check if query contains OR or NOT operators
        const hasOR = /\bOR\b/i.test(query);
        const hasNOT = /-\S+/.test(query);

        if (!hasOR && !hasNOT) {
            return null; // Use simple matching
        }

        // Split by OR first (lowest precedence)
        const orParts = query.split(/\s+OR\s+/i);

        if (orParts.length > 1) {
            // Query has OR operator
            return {
                type: 'OR',
                parts: orParts.map(part => this.parseAndTerms(part.trim()))
            };
        } else {
            // No OR, just AND/NOT
            return this.parseAndTerms(query);
        }
    }

    /**
     * Parse AND/NOT terms from a query part
     */
    parseAndTerms(queryPart) {
        const terms = [];
        const words = queryPart.split(/\s+/);

        for (const word of words) {
            if (!word) continue;

            if (word.startsWith('-')) {
                // NOT term
                const term = word.substring(1).toLowerCase();
                if (term) {
                    terms.push({ type: 'NOT', value: term });
                }
            } else {
                // MUST term
                terms.push({ type: 'MUST', value: word.toLowerCase() });
            }
        }

        return {
            type: 'AND',
            terms: terms
        };
    }

    /**
     * Match text against parsed advanced query
     */
    matchesAdvancedQuery(text, parsedQuery) {
        if (!parsedQuery) return true;

        text = text.toLowerCase();

        if (parsedQuery.type === 'OR') {
            // At least one OR part must match
            return parsedQuery.parts.some(part =>
                this.matchesAdvancedQuery(text, part)
            );
        }

        if (parsedQuery.type === 'AND') {
            // All terms must satisfy their conditions
            return parsedQuery.terms.every(term => {
                if (term.type === 'MUST') {
                    return text.includes(term.value);
                } else if (term.type === 'NOT') {
                    return !text.includes(term.value);
                }
                return true;
            });
        }

        return false;
    }

    matchesSearchText(itemText, searchQuery) {
        if (!searchQuery) return true;

        // Try advanced query parsing first (OR/NOT operators)
        const parsedQuery = this.parseAdvancedQuery(searchQuery);
        if (parsedQuery) {
            return this.matchesAdvancedQuery(itemText, parsedQuery);
        }

        // Fall back to existing simple search logic
        // (exact phrases, wildcards, enhancive search, AND terms)

        // Handle exact phrase search with quotes
        const quotedPhrases = searchQuery.match(/"([^"]+)"/g);
        if (quotedPhrases) {
            // Check all quoted phrases
            for (let phrase of quotedPhrases) {
                const cleanPhrase = phrase.slice(1, -1); // Remove quotes
                if (!itemText.includes(cleanPhrase.toLowerCase())) {
                    return false;
                }
            }
            // Remove quoted phrases from search query for remaining processing
            searchQuery = searchQuery.replace(/"[^"]+"/g, '').trim();
        }

        // Handle wildcard search with asterisks
        if (searchQuery.includes('*')) {
            // Convert wildcard pattern to regex
            const regexPattern = searchQuery.split('*').map(part =>
                part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
            ).join('.*?');

            const regex = new RegExp(regexPattern, 'i');
            return regex.test(itemText);
        }

        // Handle enhancive property searches (e.g., "9 armor use bonus" or "9 to armor use bonus")
        // Pattern: number followed by stat/skill name
        const enhancivePattern = /^(\d+)\s+(to\s+)?(.+)$/i;
        const enhanciveMatch = searchQuery.match(enhancivePattern);
        if (enhanciveMatch) {
            const boost = enhanciveMatch[1];
            const ability = enhanciveMatch[3];
            // Check if the exact phrase exists (in any of the indexed formats)
            const phrase1 = `${boost} to ${ability}`.toLowerCase();
            const phrase2 = `${boost} ${ability}`.toLowerCase();
            if (itemText.includes(phrase1) || itemText.includes(phrase2)) {
                return true;
            }
            // If the enhancive pattern matched but wasn't found, return false (don't fall through to term matching)
            return false;
        }

        // Handle regular space-separated terms (all must match)
        if (searchQuery) {
            const terms = searchQuery.split(/\s+/).filter(term => term.length > 0);
            return terms.every(term => itemText.includes(term.toLowerCase()));
        }

        return true;
    }

    matchesAllFilters(item, filters) {
        // Advanced search text filter with field-specific filtering
        if (filters.search) {
            // Build search text based on selected fields
            const searchFields = [];

            // Only search in selected fields (no automatic town/room)
            if (filters.searchFieldName) {
                searchFields.push(item.name);
            }

            // Add properties (raw, tags, enhancives, gemstones) if checkbox is checked
            if (filters.searchFieldProperties) {
                searchFields.push(
                    ...(item.raw || []),
                    ...(item.tags || []),
                    // Index enhancives in multiple formats for better searchability
                    ...(item.enhancives || []).flatMap(e => [
                        `${e.boost} to ${e.ability}`,  // "9 to Armor Use Bonus"
                        `${e.boost} ${e.ability}`,      // "9 Armor Use Bonus"
                        `${e.ability} ${e.boost}`       // "Armor Use Bonus 9"
                    ]),
                    ...(item.gemstoneProperties || []).map(p => `${p.name} ${p.rarity} ${p.mnemonic} ${p.description}`)
                );
            }

            // Add shop sign if checkbox is checked
            if (filters.searchShopSigns && item.shopSign) {
                searchFields.push(item.shopSign);
            }

            // If no fields selected, fallback to searching everything
            if (searchFields.length === 0) {
                searchFields.push(
                    item.name,
                    ...(item.raw || []),
                    ...(item.tags || [])
                );
            }

            const customSearchText = searchFields.join(' ').toLowerCase();

            if (!this.matchesSearchText(customSearchText, filters.search)) {
                return false;
            }
        }

        // Town filter - now supports multiple selections
        if (filters.towns.length > 0 && !filters.towns.includes(item.town)) {
            return false;
        }

        // Price filter - now supports multiple ranges
        if (filters.priceRanges.length > 0 && item.price !== null) {
            let matchesAnyRange = false;
            for (const rangeStr of filters.priceRanges) {
                const priceRange = DataLoader.getPriceRange(rangeStr);
                if (item.price >= priceRange.min && item.price <= priceRange.max) {
                    matchesAnyRange = true;
                    break;
                }
            }
            if (!matchesAnyRange) return false;
        }

        // Item Type filter - supports multiple selections and negation
        if (filters.itemTypes.length > 0) {
            let matchesItemType = false;
            for (const type of filters.itemTypes) {
                if (type.startsWith('!')) {
                    // Negation: "!weapon" means exclude weapons
                    const excludeType = type.substring(1);
                    if (item.itemType !== excludeType) {
                        matchesItemType = true;
                        break;
                    }
                } else {
                    // Positive match: item.itemType must equal the filter value
                    if (item.itemType === type) {
                        matchesItemType = true;
                        break;
                    }
                }
            }
            if (!matchesItemType) return false;
        }

        // Enchant filter - supports levels and boolean enchanted/not enchanted
        if (filters.enchantLevels.length > 0) {
            let matchesEnchant = false;
            for (const level of filters.enchantLevels) {
                if (level === 'enchanted') {
                    // Any enchantment
                    if (item.enchant && item.enchant > 0) {
                        matchesEnchant = true;
                        break;
                    }
                } else if (level === '!enchanted') {
                    // No enchantment
                    if (!item.enchant || item.enchant === 0) {
                        matchesEnchant = true;
                        break;
                    }
                } else {
                    // Level-based (existing logic)
                    const minEnchant = parseInt(level);
                    if (item.enchant && item.enchant >= minEnchant) {
                        matchesEnchant = true;
                        break;
                    }
                }
            }
            if (!matchesEnchant) return false;
        }

        // Container filter - supports multiple selections and negation
        if (filters.capacityLevels.length > 0) {
            let matchesContainer = false;
            for (const level of filters.capacityLevels) {
                if (level.startsWith('!')) {
                    // Negation for specific capacity level
                    const excludeLevel = level.substring(1);
                    if (item.capacityLevel !== excludeLevel) {
                        matchesContainer = true;
                        break;
                    }
                } else {
                    // Specific capacity level
                    if (item.capacityLevel === level) {
                        matchesContainer = true;
                        break;
                    }
                }
            }
            if (!matchesContainer) return false;
        }

        // Armor type filter - now supports multiple selections and negation
        if (filters.armorTypes.length > 0) {
            let matchesArmor = false;
            for (const type of filters.armorTypes) {
                // Handle negated filters for specific armor types
                if (type.startsWith('!')) {
                    const excludeType = type.substring(1);
                    if (item.armorType !== excludeType) {
                        matchesArmor = true;
                        break;
                    }
                } else {
                    // Specific armor type
                    if (item.armorType === type) {
                        matchesArmor = true;
                        break;
                    }
                }
            }
            if (!matchesArmor) return false;
        }

        // Shield type filter - now supports multiple selections and negation
        if (filters.shieldTypes.length > 0) {
            let matchesShield = false;
            for (const type of filters.shieldTypes) {
                // Handle negated filters for specific shield types
                if (type.startsWith('!')) {
                    const excludeType = type.substring(1);
                    if (!item.shieldType || !item.shieldType.includes(excludeType)) {
                        matchesShield = true;
                        break;
                    }
                } else {
                    // Specific shield size
                    if (item.shieldType && item.shieldType.includes(type)) {
                        matchesShield = true;
                        break;
                    }
                }
            }
            if (!matchesShield) return false;
        }

        // Worn filter - supports multiple selections and negation
        if (filters.wearLocations.length > 0) {
            let matchesWorn = false;
            for (const loc of filters.wearLocations) {
                if (loc.startsWith('!')) {
                    // Negation for specific wear location
                    const excludeLoc = loc.substring(1);
                    const itemLoc = (item.wearLocation || item.worn || '').toLowerCase();
                    if (!itemLoc.includes(excludeLoc.toLowerCase())) {
                        matchesWorn = true;
                        break;
                    }
                } else {
                    // Specific wear location
                    const itemLoc = (item.wearLocation || item.worn || '').toLowerCase();
                    if (itemLoc.includes(loc.toLowerCase())) {
                        matchesWorn = true;
                        break;
                    }
                }
            }
            if (!matchesWorn) return false;
        }

        // Weapon filter - supports multiple selections and negation
        if (filters.skills.length > 0) {
            let matchesWeapon = false;
            for (const skill of filters.skills) {
                if (skill.startsWith('!')) {
                    // Negation for specific weapon skill
                    const excludeSkill = skill.substring(1);
                    if (!item.skill || !item.skill.toLowerCase().includes(excludeSkill.toLowerCase())) {
                        matchesWeapon = true;
                        break;
                    }
                } else {
                    // Specific weapon skill
                    if (item.skill && item.skill.toLowerCase().includes(skill.toLowerCase())) {
                        matchesWeapon = true;
                        break;
                    }
                }
            }
            if (!matchesWeapon) return false;
        }

        // Special properties - now supports multiple selections (ALL must match)
        if (filters.specialProperties.length > 0) {
            for (const prop of filters.specialProperties) {
                if (prop === 'enhancive' && (!item.enhancives || item.enhancives.length === 0)) return false;
                if (prop === 'persists' && (!item.tags || !item.tags.includes('persists'))) return false;
                if (prop === 'crumbly' && (!item.tags || !item.tags.includes('crumbly'))) return false;
                if (prop === 'flares' && (!item.flares || item.flares.length === 0)) return false;
                if (prop === 'spiked' && (!item.tags || !item.tags.includes('spiked'))) return false;
                if (prop === 'holy' && !item.blessing) return false;
                if (prop === 'max_light' && (!item.tags || !item.tags.includes('max_light'))) return false;
                if (prop === 'max_deep' && (!item.tags || !item.tags.includes('max_deep'))) return false;
                if (prop === 'chrism') {
                    // Chrism detection: price 1k-20k AND "But you are not holding" in raw text
                    const priceInRange = item.price >= 1000 && item.price <= 20000;
                    const hasNotHoldingText = item.raw && item.raw.some(line => line.includes('But you are not holding'));
                    if (!priceInRange || !hasNotHoldingText) return false;
                }
                if (prop === 'forged') {
                    if (!item.forgedQuality && !item.forgedAvd) return false;
                }
                if (prop === 'scripted' && (!item.tags || !item.tags.includes('scripted'))) return false;
            }
        }

        // Gemstone filter - combines rarity and property count
        if (filters.gemstones.length > 0) {
            let matchesGemstone = false;
            for (const filter of filters.gemstones) {
                if (filter.startsWith('!')) {
                    // Negation for specific rarity or property count
                    const excludeFilter = filter.substring(1);
                    if (excludeFilter.endsWith('prop')) {
                        const count = parseInt(excludeFilter);
                        if (!item.gemstoneProperties || item.gemstoneProperties.length !== count) {
                            matchesGemstone = true;
                            break;
                        }
                    } else {
                        // Negation for rarity
                        if (!item.gemstoneProperties || !item.gemstoneProperties.some(prop =>
                            prop.rarity && prop.rarity.toLowerCase() === excludeFilter.toLowerCase()
                        )) {
                            matchesGemstone = true;
                            break;
                        }
                    }
                } else if (filter.endsWith('prop')) {
                    // Property count filter (e.g., "1prop", "2prop", "3prop")
                    const count = parseInt(filter);
                    if (item.gemstoneProperties && item.gemstoneProperties.length === count) {
                        matchesGemstone = true;
                        break;
                    }
                } else {
                    // Rarity filter (common, rare, regional, legendary)
                    if (item.gemstoneProperties && item.gemstoneProperties.some(prop =>
                        prop.rarity && prop.rarity.toLowerCase() === filter.toLowerCase()
                    )) {
                        matchesGemstone = true;
                        break;
                    }
                }
            }
            if (!matchesGemstone) return false;
        }

        return true;
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
        this.performSearch();
        this.updateURLState();
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

    sortItems() {
        this.filteredItems.sort((a, b) => {
            let aVal = a[this.currentSort.field];
            let bVal = b[this.currentSort.field];

            // Calculate property count dynamically if sorting by properties
            if (this.currentSort.field === 'propertyCount') {
                aVal = this.calculatePropertyCount(a);
                bVal = this.calculatePropertyCount(b);
                // For property count, 0 is a valid value, so don't treat as null
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
            tbody.innerHTML = '<tr><td colspan="5" class="no-results">No items found matching your criteria.</td></tr>';
            this.updateResultsCount();
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredItems.length);
        const pageItems = this.filteredItems.slice(startIndex, endIndex);

        pageItems.forEach(item => {
            const row = this.createItemRow(item);
            tbody.appendChild(row);
        });

        this.updateResultsCount();
    }

    createItemRow(item) {
        const row = document.createElement('tr');

        // Item name (clickable with URL link)
        const nameCell = document.createElement('td');
        const nameContainer = document.createElement('div');
        nameContainer.className = 'item-name-container';

        const nameLink = document.createElement('span');
        nameLink.className = 'item-name';
        nameLink.textContent = item.name;
        nameLink.addEventListener('click', () => this.showItemDetails(item));

        // Add quantity after name if it exists (with 2 spaces, not underlined)
        if (item.quantity) {
            const quantityText = document.createTextNode(`  (${item.quantity})`);
            nameContainer.appendChild(nameLink);
            nameContainer.appendChild(quantityText);
        } else {
            nameContainer.appendChild(nameLink);
        }

        // Register for hover tooltip (raw recall preview)
        if (window.tooltipManager) {
            window.tooltipManager.register(nameLink, item);
        }

        const urlButton = document.createElement('button');
        urlButton.className = 'url-button';
        urlButton.title = 'Copy link to this item';
        urlButton.innerHTML = '🔗';
        urlButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyItemURL(item);
        });

        const openButton = document.createElement('button');
        openButton.className = 'url-button';
        openButton.title = 'Open item in new tab';
        openButton.innerHTML = '↗️';
        openButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openItemURL(item);
        });

        const purchaseButton = document.createElement('button');
        purchaseButton.className = 'url-button';
        purchaseButton.title = 'Copy purchase command';
        purchaseButton.innerHTML = '🛒';
        purchaseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyPurchaseCommand(item);
        });

        nameContainer.appendChild(urlButton);
        nameContainer.appendChild(openButton);
        nameContainer.appendChild(purchaseButton);
        nameCell.appendChild(nameContainer);

        // Price
        const priceCell = document.createElement('td');
        priceCell.className = 'price';
        priceCell.textContent = DataLoader.formatPrice(item.price);

        // Properties
        const propsCell = document.createElement('td');
        propsCell.className = 'properties';
        propsCell.appendChild(this.createPropertiesElement(item));

        // Town
        const townCell = document.createElement('td');
        townCell.textContent = item.town;

        // Shop
        const shopCell = document.createElement('td');
        const shopDiv = document.createElement('div');

        // Create clickable shop name link
        const shopLink = document.createElement('a');
        shopLink.href = '#';
        shopLink.className = 'shop-link';
        shopLink.innerHTML = `<strong>${item.shopName}</strong>`;
        shopLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigateToShopInBrowse(item.town, item.shopName);
        });

        // Create room span
        const roomSpan = document.createElement('span');
        roomSpan.className = 'shop-location';
        roomSpan.textContent = item.room;

        // Append shop link and room to div
        shopDiv.appendChild(shopLink);
        shopDiv.appendChild(document.createElement('br'));
        shopDiv.appendChild(roomSpan);

        shopCell.appendChild(shopDiv);

        row.appendChild(nameCell);
        row.appendChild(priceCell);
        row.appendChild(propsCell);
        row.appendChild(townCell);
        row.appendChild(shopCell);

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

        // Merge forged quality
        if (item.forgedQuality) {
            detectedProps.forged = item.forgedQuality;
        }

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

        // Gemstone tags
        if (item.gemstoneProperties && item.gemstoneProperties.length > 0) {
            // Add main gemstone tag
            const gemstoneTag = document.createElement('span');
            gemstoneTag.className = 'property-tag gemstone';
            gemstoneTag.textContent = 'Gemstone';
            container.appendChild(gemstoneTag);

            // Add rarity tags in proper order: Regional -> Common -> Rare -> Legendary
            const rarityOrder = ['regional', 'common', 'rare', 'legendary'];
            const rarities = new Set();

            // Collect all unique rarities
            item.gemstoneProperties.forEach(prop => {
                if (prop.rarity) {
                    rarities.add(prop.rarity.toLowerCase());
                }
            });

            // Add tags in the correct order
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

    formatFlareDisplay(flare) {
        // Format flare text for better display
        if (typeof flare !== 'string') return String(flare);

        // Handle "mana (+X)" format
        if (flare.includes('mana (')) {
            return 'Mana flares ' + flare.replace('mana', '').trim();
        }

        // Handle "the power of X" format
        if (flare.includes('the power of')) {
            return flare.replace('the power of', 'Flares with the power of');
        }

        // Handle element-only format (e.g., "fire", "ice")
        const elementalFlares = ['fire', 'ice', 'lightning', 'acid', 'vacuum', 'plasma', 'steam', 'impact'];
        const lowerFlare = flare.toLowerCase();
        if (elementalFlares.includes(lowerFlare)) {
            return flare.charAt(0).toUpperCase() + flare.slice(1) + ' flares';
        }

        // Handle "disruption" or "disrupt" format
        if (lowerFlare.includes('disrupt')) {
            return 'Disruption flares';
        }

        // Default: capitalize first letter and ensure it looks presentable
        return flare.charAt(0).toUpperCase() + flare.slice(1);
    }

    showItemDetails(item) {
        const modal = document.getElementById('item-modal');
        const nameEl = document.getElementById('modal-item-name');
        const bodyEl = document.getElementById('modal-content-body');

        // Modal title shows just the item name (quantity is in Basic Information section)
        nameEl.textContent = item.name;

        bodyEl.innerHTML = `
            <div class="modal-section">
                <h4>Basic Information</h4>
                <p><strong>Price:</strong> ${DataLoader.formatPrice(item.price)}</p>
                ${item.quantity ? `<p><strong>Quantity Available:</strong> ${item.quantity}</p>` : ''}
                <p><strong>Town:</strong> ${item.town}</p>
                <p><strong>Shop:</strong> ${item.shopName}</p>
                <p><strong>Room:</strong> ${item.room}</p>
                <p><strong>Item ID:</strong> ${item.id}</p>
                ${item.weight ? `<p><strong>Weight:</strong> ${item.weight} pounds</p>` : ''}
                ${item.material ? `<p><strong>Material:</strong> ${item.material}</p>` : ''}
            </div>

            ${item.enchant ? `
            <div class="modal-section">
                <h4>Enchantment</h4>
                <p>+${item.enchant} enchant bonus</p>
            </div>
            ` : ''}

            ${item.forgedQuality && item.forgedAvd !== undefined ? `
            <div class="modal-section">
                <h4>Forged Weapon Quality</h4>
                <p><strong>Quality:</strong> ${item.forgedQuality.split(/[\s-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(item.forgedQuality.includes('-') ? '-' : ' ')}</p>
                <p><strong>AvD Bonus:</strong> ${item.forgedAvd >= 0 ? '+' : ''}${item.forgedAvd}</p>
                <p><strong>DF Bonus:</strong> ${item.forgedAvd * 2 >= 0 ? '+' : ''}${item.forgedAvd * 2}%</p>
                ${item.forgedBy ? `<p><strong>Forged by:</strong> ${item.forgedBy}</p>` : ''}
            </div>
            ` : ''}

            ${item.flares && item.flares.length > 0 ? `
            <div class="modal-section">
                <h4>Flares</h4>
                <div class="flares-list">
                    ${item.flares.map(flare => `
                        <p>${this.formatFlareDisplay(flare)}</p>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${item.enhancives && item.enhancives.length > 0 ? `
            <div class="modal-section">
                <h4>Enhancive Properties</h4>
                <div class="enhancive-list">
                    ${item.enhancives.map(enh => `
                        <p>+${enh.boost} to ${enh.ability}${enh.level ? ` (requires ${enh.level} training)` : ''}</p>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${item.gemstoneProperties && item.gemstoneProperties.length > 0 ? `
            <div class="modal-section">
                <h4>Gemstone Properties</h4>
                <div class="gemstone-properties">
                    ${item.gemstoneProperties.map(prop => `
                        <div class="gemstone-property">
                            <div class="property-header">
                                <strong>${prop.name}</strong>
                                <span class="rarity-badge rarity-${prop.rarity?.toLowerCase() || 'common'}">${prop.rarity || 'Common'}</span>
                                ${prop.activated ? '<span class="activated-badge">ACTIVATED</span>' : ''}
                            </div>
                            <div class="property-mnemonic">Mnemonic: ${prop.mnemonic || 'Unknown'}</div>
                            <div class="property-description">${prop.description || 'No description available'}</div>
                        </div>
                    `).join('')}
                </div>
                ${item.gemstoneBoundTo ? `<p><strong>Bound to:</strong> ${item.gemstoneBoundTo}</p>` : ''}
            </div>
            ` : ''}

            ${item.tags && item.tags.length > 0 ? `
            <div class="modal-section">
                <h4>Special Properties</h4>
                <p>${item.tags
                    .filter(tag => typeof isValidDisplayTag === 'function' ? isValidDisplayTag(tag) : typeof tag === 'string' && tag.length <= 30)
                    .map(tag => tag.replace(/_/g, ' '))
                    .join(', ')}</p>
            </div>
            ` : ''}

            <div class="modal-section">
                <h4>Shop Location${this.getShopMapInfoInline(item.shopName)}</h4>
                <p>${item.shopLocation}</p>
            </div>

            ${item.raw && item.raw.length > 0 ? `
            <div class="modal-section">
                <h4>Raw Item Data</h4>
                <div class="raw-data">${item.raw.join('\n')}</div>
            </div>
            ` : ''}
        `;

        modal.style.display = 'block';
    }

    getShopMapInfo(shopName) {
        // Extract owner name since shop_mapping uses owner names (e.g., "Painz") not full names (e.g., "Painz's Magic Shoppe")
        const ownerName = this.extractOwnerNameFromShopName(shopName);
        const shopMappingData = window.dataLoader?.shopMapping?.[ownerName];
        if (shopMappingData) {
            const mapId = shopMappingData.map_id;
            const exterior = shopMappingData.exterior;
            return `<br><span style="color: #1b5e20; font-weight: bold;">📍 Room: ${mapId}</span>${exterior ? `<br><span style="color: #2e7d32; font-style: italic;">Go: ${exterior}</span>` : ''}`;
        }
        return '';
    }

    getShopMapInfoInline(shopName) {
        // Extract owner name since shop_mapping uses owner names (e.g., "Painz") not full names (e.g., "Painz's Magic Shoppe")
        const ownerName = this.extractOwnerNameFromShopName(shopName);
        const shopMappingData = window.dataLoader?.shopMapping?.[ownerName];
        if (shopMappingData) {
            const mapId = shopMappingData.map_id;
            return ` <span style="color: #1b5e20; font-weight: bold;">(📍 Room: ${mapId})</span>`;
        }
        return '';
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

    closeModal() {
        document.getElementById('item-modal').style.display = 'none';
    }

    updateResultsCount() {
        const count = this.filteredItems.length;
        const countEl = document.getElementById('results-count');
        countEl.textContent = `${count.toLocaleString()} items found`;

        const pageInfo = document.getElementById('page-info');
        if (count > 0) {
            const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
            const endIndex = Math.min(this.currentPage * this.itemsPerPage, count);
            pageInfo.textContent = `Showing ${startIndex}-${endIndex} of ${count.toLocaleString()}`;
        } else {
            pageInfo.textContent = '';
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);

        // Update both bottom and top pagination controls
        document.getElementById('prev-page').disabled = this.currentPage <= 1;
        document.getElementById('next-page').disabled = this.currentPage >= totalPages;
        document.getElementById('prev-page-top').disabled = this.currentPage <= 1;
        document.getElementById('next-page-top').disabled = this.currentPage >= totalPages;

        const pageNumbers = document.getElementById('page-numbers');
        const pageNumbersTop = document.getElementById('page-numbers-top');
        pageNumbers.innerHTML = '';
        pageNumbersTop.innerHTML = '';

        if (totalPages <= 1) return;

        // Generate page numbers for both top and bottom
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            // Create page button for bottom pagination
            const pageBtn = document.createElement('span');
            pageBtn.className = 'page-number';
            pageBtn.textContent = i;

            // Create page button for top pagination
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
                    this.updatePagination();
                };
                pageBtn.addEventListener('click', clickHandler);
                pageBtnTop.addEventListener('click', clickHandler);
            }

            pageNumbers.appendChild(pageBtn);
            pageNumbersTop.appendChild(pageBtnTop);
        }
    }

    isActiveMode() {
        const searchMode = document.getElementById('search-mode');
        return searchMode && searchMode.style.display !== 'none';
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.displayResults();
            this.updatePagination();
            this.updateURLState();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.displayResults();
            this.updatePagination();
            this.updateURLState();
        }
    }

    clearSearch() {
        document.getElementById('search-input').value = '';
        this.performSearch();
    }

    resetFilters() {
        document.getElementById('search-input').value = '';

        // Clear all multi-select filters
        Object.values(this.multiSelectFilters).forEach(filter => {
            if (filter && filter.clear) filter.clear();
        });

        // Reset shop sign checkbox
        document.getElementById('search-shop-signs').checked = false;

        // Reset sort
        this.currentSort = { field: 'name', direction: 'asc' };
        this.updateSortIndicators();
        this.performSearch();
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

    generateItemURL(item) {
        // Create a unique identifier for the item
        const params = new URLSearchParams({
            item: item.id,
            shop: item.shopId,
            town: item.town
        });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    }

    copyItemURL(item) {
        const url = this.generateItemURL(item);

        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                this.showToast('Item URL copied to clipboard!');
            }).catch(() => {
                this.fallbackCopyURL(url);
            });
        } else {
            this.fallbackCopyURL(url);
        }
    }

    openItemURL(item) {
        const url = this.generateItemURL(item);
        window.open(url, '_blank');
    }

    copyPurchaseCommand(item) {
        const command = `SHOP PURCHASE ${item.id}`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(command).then(() => {
                this.showToast('Purchase command copied!');
            }).catch(() => {
                this.fallbackCopyText(command, 'Purchase command copied!');
            });
        } else {
            this.fallbackCopyText(command, 'Purchase command copied!');
        }
    }

    fallbackCopyText(text, successMessage) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            this.showToast(successMessage);
        } catch (err) {
            this.showToast('Failed to copy. Please copy manually: ' + text);
        }
        document.body.removeChild(textArea);
    }

    fallbackCopyURL(url) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            this.showToast('Item URL copied to clipboard!');
        } catch (err) {
            this.showToast('Failed to copy URL. Please copy manually: ' + url);
        }
        document.body.removeChild(textArea);
    }

    showToast(message) {
        // Create or update toast notification
        let toast = document.getElementById('url-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'url-toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    // Handle URL parameters on page load
    handleURLParameters() {
        const params = new URLSearchParams(window.location.search);
        const itemId = params.get('item');
        const shopId = params.get('shop');
        const town = params.get('town');

        if (itemId && shopId && town) {
            // Find and display the specific item
            this.findAndShowItemFromURL(itemId, shopId, town);
        }
    }

    findAndShowItemFromURL(itemId, shopId, town) {
        // Search through all loaded data to find the item
        setTimeout(() => {
            const dataLoader = window.dataLoader;
            if (dataLoader && dataLoader.allItems.length > 0) {
                const item = dataLoader.allItems.find(item =>
                    item.id === itemId &&
                    item.shopId === shopId &&
                    item.town === town
                );

                if (item) {
                    // Show item details
                    this.showItemDetails(item);

                    // Also search for the item name to show it in results
                    document.getElementById('search-input').value = item.name;
                    this.performSearch();
                }
            }
        }, 1000); // Wait for data to load
    }

    navigateToShopInBrowse(townName, shopName) {
        // Switch to browse tab and navigate to specific shop
        if (window.browseEngine) {
            window.browseEngine.switchToBrowseAndSelectShop(townName, shopName);
        }
    }
}

// Initialize search engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.searchEngine = new SearchEngine();

    // Handle URL parameters for direct item linking
    window.searchEngine.handleURLParameters();

    // Wait for data to load, then perform initial search
    const checkDataLoaded = () => {
        if (window.dataLoader && window.dataLoader.allItems && window.dataLoader.allItems.length > 0) {
            window.searchEngine.performSearch();
        } else {
            setTimeout(checkDataLoaded, 100);
        }
    };

    // Also listen for the custom dataLoaded event
    window.addEventListener('dataLoaded', () => {
        console.log('Received dataLoaded event, starting search...');
        window.searchEngine.performSearch();
    });

    setTimeout(checkDataLoaded, 100);

    // Initialize Tag Settings Modal
    initializeTagSettingsModal();
});

// Tag Settings Modal functionality
function initializeTagSettingsModal() {
    const settingsBtn = document.getElementById('tag-settings-btn');
    const modal = document.getElementById('tag-settings-modal');
    const closeBtn = document.getElementById('close-tag-settings');
    const saveBtn = document.getElementById('save-tag-settings');
    const resetBtn = document.getElementById('reset-tag-settings');
    const togglesContainer = document.getElementById('category-toggles');

    if (!settingsBtn || !modal || !togglesContainer) return;

    // Build individual tag toggles grouped by category
    function buildTagToggles() {
        togglesContainer.innerHTML = '';

        if (typeof TAG_DEFINITIONS === 'undefined' || typeof TAG_CATEGORIES === 'undefined') return;

        // Get tags grouped by category
        const tagsByCategory = typeof getTagsByCategory === 'function'
            ? getTagsByCategory()
            : {};

        // Get ordered tag IDs for reordering
        const orderedTagIds = typeof getOrderedTagIds === 'function'
            ? getOrderedTagIds()
            : Object.keys(TAG_DEFINITIONS);

        // Get ordered category IDs
        const orderedCategoryIds = typeof getOrderedCategoryIds === 'function'
            ? getOrderedCategoryIds()
            : Object.keys(TAG_CATEGORIES);

        // Create a section for each category (in order)
        orderedCategoryIds.forEach((catId, catIndex) => {
            const catDef = TAG_CATEGORIES[catId];
            if (!catDef) return;

            const categorySection = document.createElement('div');
            categorySection.className = 'tag-category-section';
            categorySection.dataset.categoryId = catId;

            // Category header with reorder buttons and symbol input
            const header = document.createElement('div');
            header.className = 'tag-category-header';

            // Category reorder buttons
            const catReorderBtns = document.createElement('div');
            catReorderBtns.className = 'category-reorder-btns';

            const catUpBtn = document.createElement('button');
            catUpBtn.type = 'button';
            catUpBtn.className = 'reorder-btn category-reorder';
            catUpBtn.innerHTML = '▲';
            catUpBtn.title = 'Move category up';
            catUpBtn.addEventListener('click', () => moveCategory(catId, -1));

            const catDownBtn = document.createElement('button');
            catDownBtn.type = 'button';
            catDownBtn.className = 'reorder-btn category-reorder';
            catDownBtn.innerHTML = '▼';
            catDownBtn.title = 'Move category down';
            catDownBtn.addEventListener('click', () => moveCategory(catId, 1));

            catReorderBtns.appendChild(catUpBtn);
            catReorderBtns.appendChild(catDownBtn);

            // Category name
            const catName = document.createElement('span');
            catName.className = 'category-name';
            catName.textContent = catDef.label;

            header.appendChild(catReorderBtns);
            header.appendChild(catName);
            categorySection.appendChild(header);

            // Get tags for this category in order
            const categoryTags = orderedTagIds.filter(tagId => {
                const def = TAG_DEFINITIONS[tagId];
                return def && def.category === catId;
            });

            // Tag rows container
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'tag-rows-container';

            categoryTags.forEach((tagId, index) => {
                const tagDef = TAG_DEFINITIONS[tagId];
                if (!tagDef) return;

                const row = document.createElement('div');
                row.className = 'tag-toggle-row';
                row.dataset.tagId = tagId;

                // Reorder buttons
                const reorderBtns = document.createElement('div');
                reorderBtns.className = 'tag-reorder-btns';

                const upBtn = document.createElement('button');
                upBtn.type = 'button';
                upBtn.className = 'reorder-btn';
                upBtn.innerHTML = '▲';
                upBtn.title = 'Move up';
                upBtn.addEventListener('click', () => moveTag(tagId, -1));

                const downBtn = document.createElement('button');
                downBtn.type = 'button';
                downBtn.className = 'reorder-btn';
                downBtn.innerHTML = '▼';
                downBtn.title = 'Move down';
                downBtn.addEventListener('click', () => moveTag(tagId, 1));

                reorderBtns.appendChild(upBtn);
                reorderBtns.appendChild(downBtn);

                // Checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `tag-toggle-${tagId}`;
                checkbox.checked = typeof isTagEnabled === 'function' ? isTagEnabled(tagId) : true;
                checkbox.dataset.tagId = tagId;

                // Color picker
                const colorPicker = document.createElement('input');
                colorPicker.type = 'color';
                colorPicker.className = 'tag-color-picker';
                colorPicker.id = `tag-color-${tagId}`;
                colorPicker.value = typeof getTagColor === 'function' ? getTagColor(tagId) : catDef.defaultColor;
                colorPicker.dataset.tagId = tagId;
                colorPicker.title = `Change ${tagDef.label} color`;

                // Label
                const label = document.createElement('label');
                label.htmlFor = `tag-toggle-${tagId}`;
                label.textContent = tagDef.label;

                // Description tooltip
                const desc = document.createElement('span');
                desc.className = 'tag-description';
                desc.textContent = tagDef.description;
                desc.title = tagDef.description;

                row.appendChild(reorderBtns);
                row.appendChild(checkbox);
                row.appendChild(colorPicker);
                row.appendChild(label);
                row.appendChild(desc);
                tagsContainer.appendChild(row);
            });

            categorySection.appendChild(tagsContainer);
            togglesContainer.appendChild(categorySection);
        });
    }

    // Move a tag up or down in the global order
    function moveTag(tagId, direction) {
        const settings = typeof loadTagSettings === 'function' ? loadTagSettings() : {};
        const currentOrder = typeof getOrderedTagIds === 'function'
            ? getOrderedTagIds()
            : Object.keys(TAG_DEFINITIONS);

        const currentIndex = currentOrder.indexOf(tagId);
        const newIndex = currentIndex + direction;

        if (newIndex < 0 || newIndex >= currentOrder.length) return;

        // Swap positions
        [currentOrder[currentIndex], currentOrder[newIndex]] = [currentOrder[newIndex], currentOrder[currentIndex]];

        // Save new order
        settings.tagOrder = currentOrder;
        if (typeof saveTagSettings === 'function') {
            saveTagSettings(settings);
        }
        buildTagToggles();
    }

    // Move a category up or down in the display order
    function moveCategory(categoryId, direction) {
        const settings = typeof loadTagSettings === 'function' ? loadTagSettings() : {};
        const currentOrder = typeof getOrderedCategoryIds === 'function'
            ? getOrderedCategoryIds()
            : Object.keys(TAG_CATEGORIES);

        const currentIndex = currentOrder.indexOf(categoryId);
        const newIndex = currentIndex + direction;

        if (newIndex < 0 || newIndex >= currentOrder.length) return;

        // Swap positions
        [currentOrder[currentIndex], currentOrder[newIndex]] = [currentOrder[newIndex], currentOrder[currentIndex]];

        // Save new order
        settings.categoryOrder = currentOrder;
        if (typeof saveTagSettings === 'function') {
            saveTagSettings(settings);
        }
        buildTagToggles();
    }

    // Open modal
    settingsBtn.addEventListener('click', () => {
        buildTagToggles();
        modal.hidden = false;
        modal.classList.add('active');
    });

    // Close modal
    function closeModal() {
        modal.hidden = true;
        modal.classList.remove('active');
    }

    closeBtn.addEventListener('click', closeModal);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

    // Save settings
    saveBtn.addEventListener('click', () => {
        const settings = typeof loadTagSettings === 'function' ? loadTagSettings() : {};

        // Initialize tags object if needed
        if (!settings.tags) settings.tags = {};

        // Save individual tag settings
        togglesContainer.querySelectorAll('input[type="checkbox"][data-tag-id]').forEach(cb => {
            const tagId = cb.dataset.tagId;
            if (!settings.tags[tagId]) settings.tags[tagId] = {};
            settings.tags[tagId].enabled = cb.checked;
        });

        togglesContainer.querySelectorAll('input[type="color"][data-tag-id]').forEach(cp => {
            const tagId = cp.dataset.tagId;
            if (!settings.tags[tagId]) settings.tags[tagId] = {};
            settings.tags[tagId].color = cp.value;
        });

        // Save tag order
        const orderedTags = typeof getOrderedTagIds === 'function' ? getOrderedTagIds() : [];
        settings.tagOrder = orderedTags;

        if (typeof saveTagSettings === 'function') {
            saveTagSettings(settings);
        }

        // Apply custom colors to CSS
        if (typeof applyTagColors === 'function') {
            applyTagColors();
        }

        closeModal();

        // Refresh display to apply new settings
        if (window.searchEngine) {
            window.searchEngine.displayResults();
        }
        if (window.browseEngine) {
            window.browseEngine.displayItems();
        }
    });

    // Reset to default
    resetBtn.addEventListener('click', () => {
        localStorage.removeItem('bodega-tag-settings');
        buildTagToggles();
        // Reset colors to defaults
        if (typeof applyTagColors === 'function') {
            applyTagColors();
        }
    });

    // Apply saved settings on load
    if (typeof applyTagColors === 'function') {
        applyTagColors();
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });
}

