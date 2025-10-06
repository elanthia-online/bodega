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
            gemstoneRarity: new MultiSelectFilter('gemstone-rarity-filter', 'gemstone-rarity-tags'),
            gemstoneProperties: new MultiSelectFilter('gemstone-properties-filter', 'gemstone-properties-tags'),
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
        });

        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearSearch();
        });

        // Filter controls
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('reset-filters').addEventListener('click', () => {
            this.resetFilters();
        });

        // Bottom filter controls (duplicates for mobile)
        document.getElementById('apply-filters-bottom').addEventListener('click', () => {
            this.performSearch();
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

        const allItems = window.dataLoader.allItems;
        const filters = this.getFilters();


        this.filteredItems = allItems.filter(item => {
            return this.matchesAllFilters(item, filters);
        });

        this.sortItems();
        this.currentPage = 1;
        this.displayResults();
        this.updatePagination();
    }

    getFilters() {
        return {
            search: document.getElementById('search-input').value.toLowerCase().trim(),
            searchShopSigns: document.getElementById('search-shop-signs').checked,
            towns: this.multiSelectFilters.town.getSelectedValues(),
            priceRanges: this.multiSelectFilters.price.getSelectedValues(),
            enchantLevels: this.multiSelectFilters.enchant.getSelectedValues(),
            itemTypes: this.multiSelectFilters.itemType.getSelectedValues(),
            capacityLevels: this.multiSelectFilters.capacity.getSelectedValues(),
            armorTypes: this.multiSelectFilters.armorType.getSelectedValues(),
            shieldTypes: this.multiSelectFilters.shieldType.getSelectedValues(),
            wearLocations: this.multiSelectFilters.wearLocation.getSelectedValues(),
            skills: this.multiSelectFilters.skill.getSelectedValues(),
            specialProperties: this.multiSelectFilters.specialProperties.getSelectedValues(),
            gemstoneRarities: this.multiSelectFilters.gemstoneRarity.getSelectedValues(),
            gemstonePropertyCounts: this.multiSelectFilters.gemstoneProperties.getSelectedValues()
        };
    }

    matchesSearchText(itemText, searchQuery) {
        if (!searchQuery) return true;

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
        // Advanced search text filter
        if (filters.search) {
            // If checkbox is unchecked, use searchText that excludes shop signs
            // If checkbox is checked, use the full searchText (default behavior)
            const useFullSearch = filters.searchShopSigns;

            if (useFullSearch) {
                // Original behavior - search everything including shop signs
                if (!this.matchesSearchText(item.searchText, filters.search)) {
                    return false;
                }
            } else {
                // New behavior - exclude shop signs from search
                // We'll rebuild the search text without the shop sign
                const searchTextWithoutShopSign = [
                    item.name,
                    item.town,
                    item.room || '',
                    ...(item.raw || []),
                    ...(item.tags || []),
                    item.material || '',
                    // Index enhancives in multiple formats for better searchability
                    ...(item.enhancives || []).flatMap(e => [
                        `${e.boost} to ${e.ability}`,  // "9 to Armor Use Bonus"
                        `${e.boost} ${e.ability}`,      // "9 Armor Use Bonus"
                        `${e.ability} ${e.boost}`       // "Armor Use Bonus 9"
                    ]),
                    ...(item.gemstoneProperties || []).map(p => `${p.name} ${p.rarity} ${p.mnemonic} ${p.description}`)
                ].join(' ').toLowerCase();

                if (!this.matchesSearchText(searchTextWithoutShopSign, filters.search)) {
                    return false;
                }
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

        // Enchant filter - now supports multiple selections
        if (filters.enchantLevels.length > 0) {
            let matchesEnchant = false;
            for (const level of filters.enchantLevels) {
                const minEnchant = parseInt(level);
                if (item.enchant && item.enchant >= minEnchant) {
                    matchesEnchant = true;
                    break;
                }
            }
            if (!matchesEnchant) return false;
        }

        // Item type filter - now supports multiple selections
        if (filters.itemTypes.length > 0) {
            let matchesType = false;
            for (const type of filters.itemTypes) {
                if (type === 'gemstone') {
                    // For gemstone filter, check if item has gemstone properties
                    if (item.gemstoneProperties && item.gemstoneProperties.length > 0) {
                        matchesType = true;
                        break;
                    }
                } else {
                    // For other item types, use normal filtering
                    if (item.itemType === type) {
                        matchesType = true;
                        break;
                    }
                }
            }
            if (!matchesType) return false;
        }

        // Capacity filter - now supports multiple selections
        if (filters.capacityLevels.length > 0 && !filters.capacityLevels.includes(item.capacityLevel)) {
            return false;
        }

        // Armor type filter - now supports multiple selections
        if (filters.armorTypes.length > 0 && !filters.armorTypes.includes(item.armorType)) {
            return false;
        }

        // Shield type filter - now supports multiple selections
        if (filters.shieldTypes.length > 0) {
            if (!item.shieldType) return false;
            const matchesShield = filters.shieldTypes.some(type => item.shieldType.includes(type));
            if (!matchesShield) return false;
        }

        // Wear location filter - now supports multiple selections
        if (filters.wearLocations.length > 0) {
            if (!item.wearLocation && !item.worn) return false;
            const itemLoc = (item.wearLocation || item.worn || '').toLowerCase();
            const matchesWear = filters.wearLocations.some(loc => itemLoc.includes(loc.toLowerCase()));
            if (!matchesWear) return false;
        }

        // Skill filter - now supports multiple selections
        if (filters.skills.length > 0) {
            if (!item.skill) return false;
            const matchesSkill = filters.skills.some(skill =>
                item.skill.toLowerCase().includes(skill.toLowerCase())
            );
            if (!matchesSkill) return false;
        }

        // Special properties - now supports multiple selections (ALL must match)
        if (filters.specialProperties.length > 0) {
            for (const prop of filters.specialProperties) {
                if (prop === 'enhancive' && (!item.enhancives || item.enhancives.length === 0)) return false;
                if (prop === 'persists' && (!item.tags || !item.tags.includes('persists'))) return false;
                if (prop === 'crumbly' && (!item.tags || !item.tags.includes('crumbly'))) return false;
                if (prop === 'flares' && (!item.flares || item.flares.length === 0)) return false;
                if (prop === 'holy' && !item.blessing) return false;
                if (prop === 'max_light' && (!item.tags || !item.tags.includes('max_light'))) return false;
                if (prop === 'max_deep' && (!item.tags || !item.tags.includes('max_deep'))) return false;
            }
        }

        // Gemstone rarity filter - now supports multiple selections
        if (filters.gemstoneRarities.length > 0) {
            if (!item.gemstoneProperties || item.gemstoneProperties.length === 0) return false;
            const hasMatchingRarity = item.gemstoneProperties.some(prop =>
                prop.rarity && filters.gemstoneRarities.includes(prop.rarity.toLowerCase())
            );
            if (!hasMatchingRarity) return false;
        }

        // Gemstone property count filter - now supports multiple selections
        if (filters.gemstonePropertyCounts.length > 0) {
            if (!item.gemstoneProperties) return false;
            const itemPropCount = item.gemstoneProperties.length;
            const matchesCount = filters.gemstonePropertyCounts.some(count =>
                itemPropCount === parseInt(count)
            );
            if (!matchesCount) return false;
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

        nameContainer.appendChild(nameLink);
        nameContainer.appendChild(urlButton);
        nameContainer.appendChild(openButton);
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

        // Item type
        if (item.itemType) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1);
            container.appendChild(tag);
        }

        // Enchant
        if (item.enchant) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = `+${item.enchant}`;
            container.appendChild(tag);
        }

        // Capacity
        if (item.capacityLevel) {
            const tag = document.createElement('span');
            tag.className = 'property-tag special';
            tag.textContent = item.capacityLevel.charAt(0).toUpperCase() + item.capacityLevel.slice(1);
            container.appendChild(tag);
        }

        // Armor/Weapon type
        if (item.armorType) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = item.armorType.charAt(0).toUpperCase() + item.armorType.slice(1);
            container.appendChild(tag);
        }

        if (item.weaponType) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = item.weaponType.charAt(0).toUpperCase() + item.weaponType.slice(1);
            container.appendChild(tag);
        }

        if (item.shieldType) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = item.shieldType.charAt(0).toUpperCase() + item.shieldType.slice(1);
            container.appendChild(tag);
        }

        // Skill required (but don't duplicate weapon type)
        if (item.skill && (!item.weaponType || item.skill !== item.weaponType)) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = item.skill.charAt(0).toUpperCase() + item.skill.slice(1);
            container.appendChild(tag);
        }

        // Enhancives
        if (item.enhancives && item.enhancives.length > 0) {
            item.enhancives.forEach(enh => {
                const tag = document.createElement('span');
                tag.className = 'property-tag enhancive';
                tag.textContent = `+${enh.boost} ${enh.ability}`;
                container.appendChild(tag);
            });
        }

        // Flares
        if (item.flares && item.flares.length > 0) {
            const tag = document.createElement('span');
            tag.className = 'property-tag special';
            tag.textContent = 'Flares';
            container.appendChild(tag);
        }

        // Spell
        if (item.spell) {
            const tag = document.createElement('span');
            tag.className = 'property-tag special';
            tag.textContent = 'Spell';
            container.appendChild(tag);
        }

        // Blessing
        if (item.blessing) {
            const tag = document.createElement('span');
            tag.className = 'property-tag special';
            tag.textContent = 'Holy';
            container.appendChild(tag);
        }

        // Special tags
        if (item.tags && item.tags.length > 0) {
            const specialTags = ['max_light', 'max_deep', 'persists', 'crumbly', 'holy'];
            item.tags.forEach(tag => {
                if (specialTags.includes(tag)) {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'property-tag special';
                    tagEl.textContent = tag.replace('_', ' ');
                    container.appendChild(tagEl);
                }
            });
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

    showItemDetails(item) {
        const modal = document.getElementById('item-modal');
        const nameEl = document.getElementById('modal-item-name');
        const bodyEl = document.getElementById('modal-content-body');

        nameEl.textContent = item.name;

        bodyEl.innerHTML = `
            <div class="modal-section">
                <h4>Basic Information</h4>
                <p><strong>Price:</strong> ${DataLoader.formatPrice(item.price)}</p>
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
                <p>${item.tags.map(tag => tag.replace('_', ' ')).join(', ')}</p>
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
        const shopMappingData = window.dataLoader?.shopMapping?.[shopName];
        if (shopMappingData) {
            const mapId = shopMappingData.map_id;
            const exterior = shopMappingData.exterior;
            return `<br><span style="color: #1b5e20; font-weight: bold;">📍 Room: ${mapId}</span>${exterior ? `<br><span style="color: #2e7d32; font-style: italic;">Go: ${exterior}</span>` : ''}`;
        }
        return '';
    }

    getShopMapInfoInline(shopName) {
        const shopMappingData = window.dataLoader?.shopMapping?.[shopName];
        if (shopMappingData) {
            const mapId = shopMappingData.map_id;
            return ` <span style="color: #1b5e20; font-weight: bold;">(📍 Room: ${mapId})</span>`;
        }
        return '';
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
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.displayResults();
            this.updatePagination();
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
});