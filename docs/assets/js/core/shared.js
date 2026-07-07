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
    }
};

window.BodegaShared = BodegaShared;
