/**
 * TooltipManager - Handles hover tooltips for item recall preview
 *
 * Features:
 * - 150ms delay before showing (prevents flickering)
 * - Long-press (500ms) for touch devices
 * - Single tooltip element, repositioned on hover
 * - Positions within viewport bounds
 */
class TooltipManager {
    constructor() {
        this.tooltip = document.getElementById('item-tooltip');
        this.showDelay = 150;      // ms before showing on hover
        this.longPressDelay = 500; // ms for touch long-press
        this.showTimer = null;
        this.longPressTimer = null;
        this.currentItem = null;
        this.isTouchDevice = 'ontouchstart' in window;

        // Bind methods
        this.hide = this.hide.bind(this);
    }

    /**
     * Register an item element for tooltip
     * @param {HTMLElement} element - The item link element
     * @param {Object} item - The item data with details.raw
     */
    register(element, item) {
        // Items have raw at item.raw (not item.details.raw) after processing
        const rawData = item?.raw || item?.details?.raw;
        if (!this.tooltip || !element || !rawData || rawData.length === 0) return;

        // Skip tooltip on touch devices - users can tap to see full modal instead
        if (this.isTouchDevice) return;

        const rawText = rawData.join('\n');

        // Desktop: hover to show
        element.addEventListener('mouseenter', (e) => this.onMouseEnter(e, rawText));
        element.addEventListener('mouseleave', () => this.onMouseLeave());
        element.addEventListener('mousemove', (e) => this.updatePosition(e));
    }

    onMouseEnter(event, rawText) {
        this.clearTimers();
        this.showTimer = setTimeout(() => {
            this.show(rawText, event);
        }, this.showDelay);
    }

    onMouseLeave() {
        this.clearTimers();
        this.hide();
    }

    onTouchStart(event, rawText) {
        this.clearTimers();
        this.longPressTimer = setTimeout(() => {
            this.show(rawText, event.touches[0]);
            // Prevent click from firing after long-press
            event.target.dataset.longPressed = 'true';
        }, this.longPressDelay);
    }

    onTouchEnd() {
        this.clearTimers();
        this.hide();
    }

    clearTimers() {
        if (this.showTimer) {
            clearTimeout(this.showTimer);
            this.showTimer = null;
        }
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    show(rawText, event) {
        if (!this.tooltip) return;

        this.tooltip.textContent = rawText;
        this.tooltip.hidden = false;
        this.updatePosition(event);
    }

    hide() {
        if (!this.tooltip) return;
        this.tooltip.hidden = true;
    }

    updatePosition(event) {
        if (!this.tooltip || this.tooltip.hidden) return;

        const padding = 15;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const tooltipRect = this.tooltip.getBoundingClientRect();

        let x = event.clientX + padding;
        let y = event.clientY + padding;

        // Keep within right edge
        if (x + tooltipRect.width > viewportWidth - padding) {
            x = event.clientX - tooltipRect.width - padding;
        }

        // Keep within bottom edge
        if (y + tooltipRect.height > viewportHeight - padding) {
            y = event.clientY - tooltipRect.height - padding;
        }

        // Keep within left edge
        if (x < padding) {
            x = padding;
        }

        // Keep within top edge
        if (y < padding) {
            y = padding;
        }

        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
    }
}

// Create global instance
window.tooltipManager = new TooltipManager();
