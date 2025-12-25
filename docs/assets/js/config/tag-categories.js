/**
 * Tag Configuration System
 * Individual tags with configurable visibility and colors.
 * Categories provide default color groupings.
 */

/**
 * Category definitions for default color groupings
 */
const TAG_CATEGORIES = {
    item_type: {
        label: "Item Type",
        defaultColor: "#95a5a6"
    },
    combat: {
        label: "Combat",
        defaultColor: "#e74c3c"
    },
    magical: {
        label: "Magical",
        defaultColor: "#9b59b6"
    },
    defensive: {
        label: "Defensive",
        defaultColor: "#3498db"
    },
    enhancive: {
        label: "Enhancive",
        defaultColor: "#27ae60"
    },
    properties: {
        label: "Properties",
        defaultColor: "#f39c12"
    },
    special: {
        label: "Special Features",
        defaultColor: "#1abc9c"
    }
};

/**
 * Default category display order
 */
const DEFAULT_CATEGORY_ORDER = [
    'item_type', 'combat', 'magical', 'defensive', 'enhancive', 'properties', 'special'
];

/**
 * Individual tag definitions
 * Each tag has: label, category (for default color), and description
 */
const TAG_DEFINITIONS = {
    // Item type tags
    weapon: {
        label: "Weapon",
        category: "item_type",
        description: "Item is a weapon"
    },
    armor: {
        label: "Armor",
        category: "item_type",
        description: "Item is armor"
    },
    shield: {
        label: "Shield",
        category: "item_type",
        description: "Item is a shield"
    },
    runestaff: {
        label: "Runestaff",
        category: "item_type",
        description: "Item is a runestaff"
    },

    // Container properties
    capacity: {
        label: "Capacity",
        category: "properties",
        description: "Container capacity (e.g., 'Large', 'Gigantic')"
    },

    // Combat - Weighting (offensive)
    dmg_weighting: {
        label: "Damage Weighting",
        category: "combat",
        description: "Weapon weighted to inflict more damage"
    },
    crit_weighting: {
        label: "Crit Weighting",
        category: "combat",
        description: "Weapon weighted for more critical wounds"
    },

    // Combat - Padding (defensive on armor)
    dmg_padding: {
        label: "Damage Padding",
        category: "combat",
        description: "Armor padded to lessen damage"
    },
    crit_padding: {
        label: "Crit Padding",
        category: "combat",
        description: "Armor padded against critical blows"
    },

    // Combat - Ranged
    sighting: {
        label: "Sighting",
        category: "combat",
        description: "Ranged weapon sighted for aiming"
    },
    spiked: {
        label: "Spiked",
        category: "combat",
        description: "Shield or armor is spiked"
    },

    // Forged quality (single tag with dynamic quality name display)
    forged: {
        label: "Forged",
        category: "combat",
        description: "Forged weapon quality (Perfect, Superior, Elegant, etc.)"
    },

    // Magical properties
    enchant: {
        label: "Enchant",
        category: "magical",
        description: "Item enchantment bonus (+X)"
    },
    flares: {
        label: "Flares",
        category: "magical",
        description: "Item has magical flares"
    },
    sanctify: {
        label: "Sanctification",
        category: "magical",
        description: "Item has been sanctified (S1-S5)"
    },
    ensorcell: {
        label: "Ensorcell",
        category: "magical",
        description: "Item has been ensorcelled (E1-E5)"
    },
    holy: {
        label: "Holy",
        category: "magical",
        description: "Item is holy/blessed"
    },
    gub: {
        label: "GUB",
        category: "magical",
        description: "Greater Undead Bane - bonus AS against undead"
    },

    // Defensive
    td_bonus: {
        label: "TD Bonus",
        category: "defensive",
        description: "Target Defense bonus (TD+X)"
    },
    defender: {
        label: "Defender",
        category: "defensive",
        description: "Weapon provides defensive bonus"
    },
    db_bonus: {
        label: "DB Bonus",
        category: "defensive",
        description: "Defensive Bonus from item"
    },
    magic_resistant: {
        label: "Magic Resistant",
        category: "defensive",
        description: "Item resists magical attacks"
    },

    // Enhancives
    enhancive: {
        label: "Enhancive Stats",
        category: "enhancive",
        description: "Item provides stat bonuses"
    },
    persists: {
        label: "Persists",
        category: "enhancive",
        description: "Enhancive properties are permanent"
    },
    crumbly: {
        label: "Crumbly",
        category: "enhancive",
        description: "Enhancive will decay with use"
    },

    // Properties (merchant services, container features)
    max_light: {
        label: "Max Light",
        category: "properties",
        description: "Maximum lightened"
    },
    max_deep: {
        label: "Max Deep",
        category: "properties",
        description: "Maximum deepened"
    },
    lightenable: {
        label: "Lightenable",
        category: "properties",
        description: "Can be lightened further"
    },
    deepenable: {
        label: "Deepenable",
        category: "properties",
        description: "Can be deepened further"
    },

    // Special features
    scripted: {
        label: "Scripted",
        category: "special",
        description: "Item has custom scripts"
    },
    flourish: {
        label: "Flourish",
        category: "special",
        description: "Item has flourish messaging"
    },
    imbeddable: {
        label: "Imbeddable",
        category: "special",
        description: "Item can hold imbedded spells"
    },
    imbedded: {
        label: "Imbedded",
        category: "special",
        description: "Item currently has imbedded spells"
    },
    chrism: {
        label: "Chrism",
        category: "special",
        description: "Gem is a chrism (preserves experience on death)"
    }
};

/**
 * Default display order for tags
 */
/**
 * Default display order for tags - grouped by category so same colors appear together
 */
const DEFAULT_TAG_ORDER = [
    // Item Type (gray)
    'weapon', 'armor', 'shield', 'runestaff',
    // Magical (purple)
    'enchant', 'flares', 'sanctify', 'ensorcell', 'holy', 'gub',
    // Combat (red)
    'dmg_weighting', 'crit_weighting', 'dmg_padding', 'crit_padding', 'sighting', 'spiked', 'forged',
    // Defensive (blue)
    'td_bonus', 'defender', 'db_bonus', 'magic_resistant',
    // Enhancive (green)
    'enhancive', 'persists', 'crumbly',
    // Properties (orange) - merchant services, container features
    'capacity', 'max_light', 'max_deep', 'lightenable', 'deepenable',
    // Special Features (teal)
    'scripted', 'flourish', 'imbeddable', 'imbedded', 'chrism'
];

/**
 * Load tag settings from localStorage
 * @returns {Object} Tag settings object
 */
function loadTagSettings() {
    const saved = localStorage.getItem('bodega-tag-settings');
    return saved ? JSON.parse(saved) : {};
}

/**
 * Save tag settings to localStorage
 * @param {Object} settings - Tag settings to save
 */
function saveTagSettings(settings) {
    localStorage.setItem('bodega-tag-settings', JSON.stringify(settings));
}

/**
 * Get ordered category IDs based on saved settings
 * @returns {string[]} Array of category IDs in display order
 */
function getOrderedCategoryIds() {
    const settings = loadTagSettings();
    if (settings.categoryOrder && Array.isArray(settings.categoryOrder)) {
        // Use saved order, but ensure all categories are included
        const savedOrder = settings.categoryOrder.filter(id => DEFAULT_CATEGORY_ORDER.includes(id));
        const missing = DEFAULT_CATEGORY_ORDER.filter(id => !savedOrder.includes(id));
        return [...savedOrder, ...missing];
    }
    return [...DEFAULT_CATEGORY_ORDER];
}

/**
 * Check if an individual tag is enabled (default: true)
 * @param {string} tagId - The tag identifier
 * @returns {boolean} Whether the tag is enabled
 */
function isTagEnabled(tagId) {
    const settings = loadTagSettings();
    if (settings.tags && settings.tags[tagId] !== undefined) {
        return settings.tags[tagId].enabled !== false;
    }
    return true;
}

/**
 * Get the color for a tag (custom or default from category)
 * @param {string} tagId - The tag identifier
 * @returns {string} Hex color code
 */
function getTagColor(tagId) {
    const settings = loadTagSettings();
    const tagDef = TAG_DEFINITIONS[tagId];

    // Check for custom tag color
    if (settings.tags && settings.tags[tagId] && settings.tags[tagId].color) {
        return settings.tags[tagId].color;
    }

    // Fall back to category default color
    if (tagDef && TAG_CATEGORIES[tagDef.category]) {
        return TAG_CATEGORIES[tagDef.category].defaultColor;
    }

    return '#888888'; // Fallback gray
}

/**
 * Get ordered tag IDs based on saved settings
 * @returns {string[]} Array of tag IDs in display order
 */
function getOrderedTagIds() {
    const settings = loadTagSettings();

    if (settings.tagOrder && Array.isArray(settings.tagOrder)) {
        // Use saved order, but ensure all tags are included
        const savedOrder = settings.tagOrder.filter(id => DEFAULT_TAG_ORDER.includes(id));
        const missing = DEFAULT_TAG_ORDER.filter(id => !savedOrder.includes(id));
        return [...savedOrder, ...missing];
    }
    return [...DEFAULT_TAG_ORDER];
}

/**
 * Check if a tag should be visible (alias for isTagEnabled)
 * @param {string} tag - The tag name
 * @returns {boolean} Whether the tag should be displayed
 */
function isTagVisible(tag) {
    return isTagEnabled(tag);
}

/**
 * Legacy function for category-based visibility (for backward compatibility)
 * Now checks individual tag settings
 * @param {string} categoryId - The category identifier
 * @returns {boolean} Whether any tag in the category is enabled
 */
function isCategoryEnabled(categoryId) {
    // For backward compatibility, check if ANY tag in the category is enabled
    const categoryTags = Object.entries(TAG_DEFINITIONS)
        .filter(([_, def]) => def.category === categoryId)
        .map(([id, _]) => id);

    return categoryTags.some(tagId => isTagEnabled(tagId));
}

/**
 * Legacy function to load category settings
 * @returns {Object} Category settings object
 */
function loadCategorySettings() {
    return loadTagSettings();
}

/**
 * Legacy function to save category settings
 * @param {Object} settings - Settings to save
 */
function saveCategorySettings(settings) {
    saveTagSettings(settings);
}

/**
 * Get the category for a given tag
 * @param {string} tag - The tag name
 * @returns {string|null} Category ID or null if not found
 */
function getCategoryForTag(tag) {
    const tagDef = TAG_DEFINITIONS[tag];
    return tagDef ? tagDef.category : null;
}

/**
 * Maximum tag display length - tags longer than this will be truncated
 */
const MAX_TAG_LENGTH = 40;

/**
 * Descriptor mapping for display formatting
 */
const DESCRIPTOR_MAP = {
    'very heavily': 'V.Heavy',
    'exceptionally': 'Except',
    'lightly': 'Light',
    'somewhat': 'Somewhat',
    'fairly': 'Fairly',
    'heavily': 'Heavy',
    'masterfully': 'Masterful',
    'unknown': '??'
};

/**
 * Format a descriptor for display
 * @param {string} str - Raw descriptor string
 * @returns {string} Formatted descriptor
 */
function formatDescriptor(str) {
    if (!str || typeof str !== 'string') return '';
    const lower = str.toLowerCase();
    return DESCRIPTOR_MAP[lower] || str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate a string if it exceeds MAX_TAG_LENGTH
 * @param {string} str - String to truncate
 * @returns {string} Truncated string or null if too long to be meaningful
 */
function truncateTag(str) {
    if (!str || typeof str !== 'string') return str;
    if (str.length <= MAX_TAG_LENGTH) return str;
    // Skip tags that are way too long (likely description text, not a tag)
    if (str.length > MAX_TAG_LENGTH * 2) return null;
    return str.substring(0, MAX_TAG_LENGTH - 3) + '...';
}

/**
 * Format a property for display with GemStone-familiar notation
 * @param {string} key - Property key
 * @param {*} value - Property value
 * @param {Object} allProps - All properties (for checking related flags)
 * @returns {string|null} Formatted display string, or null if should be skipped
 */
function formatPropertyDisplay(key, value, allProps) {
    // Skip if key itself is too long (indicates invalid data)
    if (key && key.length > MAX_TAG_LENGTH) return null;

    const desc = formatDescriptor(value);
    const tempSuffix = allProps[key + '_temp'] ? ' (T)' : '';

    let result;
    switch(key) {
        case 'td_bonus':
            return `TD+${value}`;
        case 'db_bonus':
            return `DB+${value}`;
        case 'defender':
            return `Defender +${value}`;
        case 'sanctify':
            return value === 5 && allProps.holy_fire ? 'S5 Holy Fire' : `S${value}`;
        case 'ensorcell':
            return `E${value}`;
        case 'enchant':
            return `+${value}`;
        case 'dmg_padding':
        case 'dmg_weighting':
            return `Dmg: ${desc}${tempSuffix}`;
        case 'crit_padding':
        case 'crit_weighting':
            return `Crit: ${desc}${tempSuffix}`;
        case 'sighting':
            return `Sight: ${desc}${tempSuffix}`;
        case 'spiked':
            return 'Spiked';
        case 'forged':
            // Capitalize quality name (handles hyphenated names like "well-crafted", "lop-sided")
            if (!value || typeof value !== 'string') return 'Forged';
            return value.split(/[\s-]/).map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(value.includes('-') ? '-' : ' ');
        case 'magic_resistant':
            return 'Magic Resistant';
        case 'scripted':
            return 'Scripted';
        case 'flourish':
            return 'Flourish';
        case 'max_light':
            return 'Max Light';
        case 'max_deep':
            return 'Max Deep';
        case 'lightenable':
            return 'Lightenable';
        case 'deepenable':
            return 'Deepenable';
        case 'persists':
            return 'Persists';
        case 'crumbly':
            return 'Crumbly';
        case 'holy':
            return 'Holy';
        case 'gub':
            return 'GUB';
        case 'imbeddable':
            return 'Imbeddable';
        case 'imbedded':
            return 'Imbedded';
        case 'flares':
            if (typeof value === 'string') {
                const flareText = `${value} Flares`;
                return truncateTag(flareText);
            }
            return 'Flares';
        case 'capacity':
            if (typeof value === 'string') {
                return truncateTag(value) || 'Container';
            }
            return 'Container';
        case 'enhancive':
            return 'Enhancive';
        case 'chrism':
            return 'Chrism';
        default:
            // Apply truncation to unknown tags - if too long, skip entirely
            const defaultText = key.replace(/_/g, ' ');
            return truncateTag(defaultText);
    }
}

/**
 * Check if a tag should be displayed
 * @param {string} tagId - Tag identifier
 * @returns {boolean} True if tag should be displayed
 */
function isValidDisplayTag(tagId) {
    if (!tagId || typeof tagId !== 'string') return false;
    if (tagId.length > 30) return false;

    // Check if tag is defined in TAG_DEFINITIONS
    if (TAG_DEFINITIONS[tagId]) return true;

    // Check if tag is a known boolean tag
    const knownBoolTags = ['spiked', 'magic_resistant', 'scripted', 'holy_fire',
                           'max_light', 'max_deep', 'persists', 'crumbly', 'holy',
                           'lightenable', 'deepenable', 'imbeddable'];
    return knownBoolTags.includes(tagId);
}

/**
 * Detect properties from raw item text (for backward compatibility)
 * @param {string[]} rawLines - Array of raw text lines from item analysis
 * @returns {Object} Detected properties
 */
function detectPropertiesFromRaw(rawLines) {
    const props = {};
    if (!rawLines || rawLines.length === 0) return props;

    const rawText = rawLines.join('\n');

    // TD Bonus
    const tdMatch = rawText.match(/protects against magical attacks with a bonus of (\d+)/i);
    if (tdMatch) props.td_bonus = parseInt(tdMatch[1]);

    // DB Bonus (from shields/items)
    const dbMatch = rawText.match(/provides a bonus of \+(\d+) to Defensive Strength/i);
    if (dbMatch) props.db_bonus = parseInt(dbMatch[1]);

    // Defender bonus on weapons
    const defenderMatch = rawText.match(/provides a bonus of \+(\d+) more than usual/i);
    if (defenderMatch) props.defender = parseInt(defenderMatch[1]);

    // Sanctify + Holy Fire + GUB
    const sanctMatch = rawText.match(/has been sanctified (\d+) times?/i);
    if (sanctMatch) {
        props.sanctify = parseInt(sanctMatch[1]);
        props.holy_fire = /permanent Holy Fire flares/i.test(rawText);
        props.gub = /provides an additional \+\d+ AS bonus against the undead/i.test(rawText);
    }

    // Ensorcell
    const ensMatch = rawText.match(/has been ensorcelled (\d+) times?/i);
    if (ensMatch) props.ensorcell = parseInt(ensMatch[1]);

    // Flares detection - check "infused with" pattern first
    const infusedMatch = rawText.match(/It has been infused with (?:the (?:power|essence) of )?(?:an? )?(.+?)\./i);
    if (infusedMatch) {
        props.flares = infusedMatch[1];
    }
    // Then check for specific flare types in "X flares" format
    if (!props.flares) {
        const flareTypes = ['fire', 'ice', 'lightning', 'steam', 'acid', 'plasma', 'disruption', 'vacuum', 'holy', 'unholy', 'grapple', 'impact'];
        for (const flareType of flareTypes) {
            if (new RegExp(`${flareType} flares`, 'i').test(rawText)) {
                props.flares = flareType.charAt(0).toUpperCase() + flareType.slice(1);
                break;
            }
        }
    }
    // Fallback: generic flares detection
    if (!props.flares && /\bflares\b/i.test(rawText)) {
        props.flares = true;
    }

    // FORGED: Quality detection (fallback for items without parsed details)
    const forgedMatch = rawText.match(/It is forged by (.*?) and has (?:increased|decreased) \(([+-]?\d+)\) effectiveness in combat\./i);
    if (forgedMatch) {
        const forgedAvd = parseInt(forgedMatch[2]);
        const qualityNameMap = {
            3: 'perfect',
            2: 'superior',
            1: 'elegant',
            0: 'fine',
            '-1': 'simple',
            '-2': 'crude',
            '-3': 'flimsy'
        };
        const qualityName = qualityNameMap[forgedAvd];
        if (qualityName) {
            props.forged = qualityName;
        }
    }

    // ARMOR: Damage Padding
    const dmgPadMatch = rawText.match(/(temporarily )?(somewhat |fairly |heavily |very heavily |masterfully )?padded to lessen the damage/i);
    if (dmgPadMatch) {
        props.dmg_padding = dmgPadMatch[2] ? dmgPadMatch[2].trim().toLowerCase() : 'unknown';
        props.dmg_padding_temp = !!dmgPadMatch[1];
    }

    // ARMOR: Crit Padding
    const critPadMatch = rawText.match(/(temporarily )?(somewhat |fairly |heavily |very heavily |masterfully )?padded against critical blows/i);
    if (critPadMatch) {
        props.crit_padding = critPadMatch[2] ? critPadMatch[2].trim().toLowerCase() : 'unknown';
        props.crit_padding_temp = !!critPadMatch[1];
    }

    // WEAPON: Damage Weighting
    const dmgWgtMatch = rawText.match(/(temporarily )?(lightly |somewhat |fairly |heavily |very heavily |exceptionally )?weighted to inflict more damage/i);
    if (dmgWgtMatch) {
        props.dmg_weighting = dmgWgtMatch[2] ? dmgWgtMatch[2].trim().toLowerCase() : 'unknown';
        props.dmg_weighting_temp = !!dmgWgtMatch[1];
    }

    // WEAPON: Crit Weighting
    const critWgtMatch = rawText.match(/(temporarily )?(lightly |somewhat |fairly |heavily |very heavily |exceptionally )?weighted to inflict more critical wounds/i);
    if (critWgtMatch) {
        props.crit_weighting = critWgtMatch[2] ? critWgtMatch[2].trim().toLowerCase() : 'unknown';
        props.crit_weighting_temp = !!critWgtMatch[1];
    }

    // RANGED: Sighting
    const sightMatch = rawText.match(/(temporarily )?(somewhat |fairly |heavily |very heavily )?sighted to assist in aiming/i);
    if (sightMatch) {
        props.sighting = sightMatch[2] ? sightMatch[2].trim().toLowerCase() : 'unknown';
        props.sighting_temp = !!sightMatch[1];
    }

    // Boolean properties
    if (/It is spiked\./i.test(rawText)) props.spiked = true;
    if (/It is magic resistant\./i.test(rawText)) props.magic_resistant = true;
    if (/Additional scripts have been applied|has a Custom.*script|Shield Cape Collection|It is Tier \d+|Blink Weapon|briar flare weapon|has some unknown \(scripted\) benefit/i.test(rawText)) {
        props.scripted = true;
    }

    // Flourish
    if (/It has the .* Flourish/i.test(rawText)) {
        props.flourish = true;
    }

    // Imbeddable / Imbedded
    if (/can be imbedded|ready to be imbedded|imbeddable/i.test(rawText)) {
        props.imbeddable = true;
    }
    if (/has been imbedded|currently imbedded|contains.*spell/i.test(rawText)) {
        props.imbedded = true;
    }

    // Enhancive persistence - check if item has enhancives and whether they persist or crumble
    if (/enhancive|bonus.*will|properties.*permanent|properties.*crumble|properties.*decay/i.test(rawText)) {
        if (/properties are permanent|will persist|permanently/i.test(rawText)) {
            props.persists = true;
        } else if (/will crumble|will decay|crumbly|uses remaining/i.test(rawText)) {
            props.crumbly = true;
        }
    }

    return props;
}

/**
 * Get CSS class for a category (legacy support)
 * @param {string} categoryId - Category identifier
 * @returns {string} CSS class name
 */
function getCategoryClass(categoryId) {
    const classMap = {
        item_type: 'cat-item-type',
        combat: 'cat-combat',
        magical: 'cat-magical',
        defensive: 'cat-defensive',
        enhancive: 'cat-enhancive',
        properties: 'cat-properties',
        special: 'cat-special'
    };
    return classMap[categoryId] || '';
}

/**
 * Get inline style for a tag based on its configured color
 * @param {string} tagId - Tag identifier
 * @returns {string} CSS color value
 */
function getTagColorStyle(tagId) {
    return getTagColor(tagId);
}

/**
 * Apply tag colors to CSS custom properties
 */
function applyTagColors() {
    const root = document.documentElement;

    for (const tagId of Object.keys(TAG_DEFINITIONS)) {
        const color = getTagColor(tagId);
        root.style.setProperty(`--tag-${tagId}-color`, color);
    }
}

/**
 * Get all tags grouped by category for settings UI
 * @returns {Object} Tags grouped by category
 */
function getTagsByCategory() {
    const grouped = {};

    for (const [tagId, tagDef] of Object.entries(TAG_DEFINITIONS)) {
        const category = tagDef.category;
        if (!grouped[category]) {
            grouped[category] = {
                label: TAG_CATEGORIES[category].label,
                defaultColor: TAG_CATEGORIES[category].defaultColor,
                tags: []
            };
        }
        grouped[category].tags.push({
            id: tagId,
            ...tagDef,
            enabled: isTagEnabled(tagId),
            color: getTagColor(tagId)
        });
    }

    return grouped;
}
