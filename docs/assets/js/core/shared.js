// Shared rendering/utility helpers used by all view engines
// (search, browse, added, removed). Single source of truth replacing four
// previously-duplicated copies in the component files.
//
// Depends on globals from config/tag-categories.js (TAG_DEFINITIONS,
// getOrderedTagIds, isTagVisible, isTagEnabled, getTagColor,
// getCategoryForTag, formatPropertyDisplay) and core/data-loader.js
// (DataLoader.formatPrice). Loaded via script tag before the components.

const BodegaShared = {

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
    },

    formatPrice(price) {
        return DataLoader.formatPrice(price);
    },

    calculatePropertyCount(item) {
        // Only count enhancive properties (green stat bonuses)
        if (item.enhancives && item.enhancives.length > 0) {
            return item.enhancives.length;
        }
        return 0;
    },

    extractOwnerNameFromShopName(shopName) {
        // The owner location index uses owner names (e.g., "Painz") not full
        // shop names (e.g., "Painz's Magic Shoppe")
        if (!shopName) return shopName;

        const match = shopName.match(/^(.*?)'s?\s+(Magic Shoppe|Weaponry|Armory|Outfitting|General Store|Combat Gear|Locksmith Shop|Shop|Boutique)/i);
        if (match) {
            return match[1].trim();
        }

        const possessiveMatch = shopName.match(/^(.*?)'s\s+(.*)$/i);
        if (possessiveMatch) {
            return possessiveMatch[1].trim();
        }

        return shopName;
    },

    // Build the property-tag element block for an item row.
    // All properties come from processor.rb output mapped by
    // DataLoader.processItem — the browser does no raw-text parsing
    // (see CLAUDE.md: processor.rb does ALL extraction).
    createPropertiesElement(item) {
        const container = document.createElement('div');

        const detectedProps = {};

        // Item classification
        if (item.itemType) detectedProps[item.itemType] = true;
        if (item.armorType) detectedProps.armor_type = item.armorType;
        if (item.weaponType) detectedProps.weapon_type = item.weaponType;
        if (item.shieldType) detectedProps.shield_type = item.shieldType;
        if (item.capacityLevel) detectedProps.capacity = item.capacityLevel;
        if (item.enchant) detectedProps.enchant = item.enchant;

        // Skill (but don't duplicate weapon type)
        if (item.skill && (!item.weaponType || item.skill !== item.weaponType)) {
            detectedProps._skill = item.skill;
        }

        // Combat / magical properties from processed fields
        if (item.td_bonus) detectedProps.td_bonus = item.td_bonus;
        if (item.db_bonus) detectedProps.db_bonus = item.db_bonus;
        if (item.defender) detectedProps.defender = item.defender;
        if (item.sanctify) detectedProps.sanctify = item.sanctify;
        if (item.ensorcell) detectedProps.ensorcell = item.ensorcell;
        if (item.dmg_padding) {
            detectedProps.dmg_padding = item.dmg_padding;
            if (item.temporary_dmg_padding) detectedProps.dmg_padding_temp = true;
        }
        if (item.crit_padding) {
            detectedProps.crit_padding = item.crit_padding;
            if (item.temporary_crit_padding) detectedProps.crit_padding_temp = true;
        }
        if (item.dmg_weighting) {
            detectedProps.dmg_weighting = item.dmg_weighting;
            if (item.temporary_dmg_weighting) detectedProps.dmg_weighting_temp = true;
        }
        if (item.crit_weighting) {
            detectedProps.crit_weighting = item.crit_weighting;
            if (item.temporary_crit_weighting) detectedProps.crit_weighting_temp = true;
        }
        if (item.sighting) detectedProps.sighting = item.sighting;
        if (item.blessing) detectedProps.holy = true;
        if (item.flares && item.flares.length > 0) detectedProps.flares = true;
        if (item.enhancives && item.enhancives.length > 0) detectedProps.enhancive = true;
        if (item.forgedQuality) detectedProps.forged = item.forgedQuality;
        if (item.chrism) detectedProps.chrism = true;

        // Boolean properties carried as tags by the extractor
        if (item.tags && item.tags.length > 0) {
            const boolTags = ['spiked', 'magic_resistant', 'scripted', 'holy_fire',
                              'max_light', 'max_deep', 'persists', 'crumbly', 'holy',
                              'lightenable', 'deepenable', 'imbeddable', 'imbedded',
                              'flourish', 'gub', 'chrism'];
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

        const makeTypedTag = (tagId, text, category) => {
            const tag = document.createElement('span');
            tag.className = `property-tag cat-${category}`;
            tag.dataset.category = category;
            const tagColor = typeof getTagColor === 'function' ? getTagColor(tagId) : null;
            if (tagColor) {
                tag.style.color = tagColor;
                tag.style.borderColor = tagColor;
                tag.style.backgroundColor = 'transparent';
            }
            tag.textContent = text;
            container.appendChild(tag);
        };

        orderedTags.forEach(tagId => {
            // Item type tags (weapon, armor, shield, container, jewelry)
            if (['weapon', 'armor', 'shield', 'container', 'jewelry'].includes(tagId)) {
                if (detectedProps[tagId] && (typeof isTagVisible !== 'function' || isTagVisible(tagId))) {
                    makeTypedTag(tagId, tagId.charAt(0).toUpperCase() + tagId.slice(1), 'item_type');
                }
                return;
            }

            // Enchant
            if (tagId === 'enchant') {
                if (detectedProps.enchant && (typeof isTagVisible !== 'function' || isTagVisible('enchant'))) {
                    makeTypedTag('enchant', `+${detectedProps.enchant}`, 'magical');
                }
                return;
            }

            // Capacity
            if (tagId === 'capacity') {
                if (detectedProps.capacity) {
                    const tag = document.createElement('span');
                    tag.className = 'property-tag special';
                    tag.textContent = detectedProps.capacity.charAt(0).toUpperCase() + detectedProps.capacity.slice(1);
                    container.appendChild(tag);
                }
                return;
            }

            // armor_type / weapon_type / shield_type
            if (['armor_type', 'weapon_type', 'shield_type'].includes(tagId)) {
                const value = detectedProps[tagId];
                if (value && (typeof isTagVisible !== 'function' || isTagVisible(tagId))) {
                    makeTypedTag(tagId, value.charAt(0).toUpperCase() + value.slice(1), 'item_type');
                }
                return;
            }

            // Enhancive - display individual enhancive stats
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
                return; // No generic "Enhancive" tag; the individual stats are shown
            }

            // Flares - single static tag
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

            // Everything else renders generically via formatPropertyDisplay
            if (detectedProps[tagId] !== undefined && detectedProps[tagId] !== false) {
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
                if (displayText.length > 50) return;
                tagEl.textContent = displayText;
                container.appendChild(tagEl);
            }
        });

        // Skill tag (after ordered tags, when not a duplicate of weapon type)
        if (detectedProps._skill) {
            const tag = document.createElement('span');
            tag.className = 'property-tag';
            tag.textContent = detectedProps._skill.charAt(0).toUpperCase() + detectedProps._skill.slice(1);
            container.appendChild(tag);
        }

        // Gemstone tags
        if (item.gemstoneProperties && item.gemstoneProperties.length > 0) {
            const gemstoneTag = document.createElement('span');
            gemstoneTag.className = 'property-tag gemstone';
            gemstoneTag.textContent = 'Gemstone';
            container.appendChild(gemstoneTag);

            // Rarity tags in order: Regional -> Common -> Rare -> Legendary
            const rarityOrder = ['regional', 'common', 'rare', 'legendary'];
            const rarities = new Set();
            item.gemstoneProperties.forEach(prop => {
                if (prop.rarity) {
                    rarities.add(prop.rarity.toLowerCase());
                }
            });
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
    },

    // Show one sidebar mode (search/browse/added/removed) and mark its tab
    // as current. Each engine still handles its own table/pagination setup.
    activateMode(mode) {
        ['search', 'browse', 'added', 'removed'].forEach(name => {
            const tab = document.getElementById(`${name}-tab`);
            const panel = document.getElementById(`${name}-mode`);
            const active = name === mode;
            if (tab) {
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-pressed', active ? 'true' : 'false');
            }
            if (panel) panel.style.display = active ? 'block' : 'none';
        });
    },

    // Update the sort arrow and aria-sort on the results table headers, and
    // make every sortable header keyboard-focusable (headers are re-rendered
    // per mode, so this runs after each render via updateSortIndicators).
    updateSortHeaders(headerField, direction) {
        document.querySelectorAll('#results-table th.sortable').forEach(th => {
            th.tabIndex = 0;
            const indicator = th.querySelector('.sort-indicator');
            if (th.dataset.sort === headerField) {
                th.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
                if (indicator) indicator.textContent = direction === 'asc' ? ' ↑' : ' ↓';
            } else {
                th.removeAttribute('aria-sort');
                if (indicator) indicator.textContent = '';
            }
        });
    },

    // Make a non-button element (e.g. an item name span) reachable and
    // operable from the keyboard. Enter/Space fire its click handlers, which
    // bubble the same way a mouse click does.
    makeActivatable(element, label) {
        element.tabIndex = 0;
        element.setAttribute('role', 'button');
        if (label) element.setAttribute('aria-label', label);
        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                element.click();
            }
        });
    },

    // Render page-number buttons into the top and bottom pagination bars and
    // set the Previous/Next disabled state. Shows the first and last page plus
    // two pages either side of the current one, with ellipses for the gaps.
    renderPagination(currentPage, totalPages, onPageSelect) {
        document.getElementById('prev-page').disabled = currentPage <= 1;
        document.getElementById('next-page').disabled = currentPage >= totalPages;
        document.getElementById('prev-page-top').disabled = currentPage <= 1;
        document.getElementById('next-page-top').disabled = currentPage >= totalPages;

        const containers = [
            document.getElementById('page-numbers'),
            document.getElementById('page-numbers-top')
        ];
        containers.forEach(container => { container.innerHTML = ''; });

        if (totalPages <= 1) return;

        const pages = [];
        const windowStart = Math.max(2, currentPage - 2);
        const windowEnd = Math.min(totalPages - 1, currentPage + 2);
        pages.push(1);
        if (windowStart > 3) pages.push('gap');
        else if (windowStart === 3) pages.push(2);
        for (let i = windowStart; i <= windowEnd; i++) pages.push(i);
        if (windowEnd < totalPages - 2) pages.push('gap');
        else if (windowEnd === totalPages - 2) pages.push(totalPages - 1);
        pages.push(totalPages);

        containers.forEach(container => {
            pages.forEach(page => {
                if (page === 'gap') {
                    const gap = document.createElement('span');
                    gap.className = 'page-gap';
                    gap.setAttribute('aria-hidden', 'true');
                    gap.textContent = '…';
                    container.appendChild(gap);
                    return;
                }

                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'page-number';
                button.textContent = page;
                button.setAttribute('aria-label', `Page ${page}`);
                if (page === currentPage) {
                    button.classList.add('current');
                    button.setAttribute('aria-current', 'page');
                } else {
                    button.addEventListener('click', () => onPageSelect(page));
                }
                container.appendChild(button);
            });
        });
    },

    // Modal focus handling: move focus into the dialog, keep Tab inside it,
    // and return focus to whatever opened it when it closes.
    openDialog(dialog, initialFocus) {
        const previous = document.activeElement;
        const focusable = () => Array.from(dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.disabled && el.offsetParent !== null);

        const onKeydown = (event) => {
            if (event.key !== 'Tab') return;
            const items = focusable();
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        dialog.addEventListener('keydown', onKeydown);
        (initialFocus || focusable()[0] || dialog).focus();

        return function release() {
            dialog.removeEventListener('keydown', onKeydown);
            if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
                previous.focus();
            }
        };
    }
};

window.BodegaShared = BodegaShared;

// Sortable column headers are re-rendered per mode; delegate keyboard
// activation (Enter/Space) from the table so every rendering gets it.
document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('results-table');
    if (!table) return;
    table.addEventListener('keydown', (event) => {
        const th = event.target.closest && event.target.closest('th.sortable');
        if (th && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            th.click();
        }
    });
});
