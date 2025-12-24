# Bodega Accessibility Roadmap

## Phase 1: Core Accessibility - COMPLETE

Implemented features:
- **Size selector** (A-/A/A+) with 1.0/1.2/1.5 zoom scaling (WCAG 1.4.4)
- **High Contrast theme** for low vision users (WCAG AAA)
- **Improved contrast** in light/dark themes (WCAG AA - 4.5:1 ratio)
- **aria-label** attributes on all select elements (WCAG 2.1)
- **Heading hierarchy** fixed h3→h2 (WCAG 1.3.1)
- **Compact shop cards** at 80% base size

---

## Phase 2: Universal Accessibility Features

Goal: Features that are **discoverable** and work **out of the box** for users who need them.

### 1. Skip Link (WCAG 2.4.1 - Level A)

**What**: Hidden link at top of page that becomes visible on focus, allowing keyboard users to skip navigation.

**Why discoverable**: Every accessibility-aware user knows to Tab first thing on a page. Standard pattern.

**Files:** `docs/index.html`, `docs/assets/css/main.css`

---

### 2. Enhanced Focus Indicators (WCAG 2.4.7 - Level AA)

**What**: Clear, visible focus rings on all interactive elements.

**Why discoverable**: Automatic - keyboard users see it when they Tab.

**Files:** `docs/assets/css/main.css`

---

### 3. ARIA Landmarks (WCAG 1.3.1, 2.4.1)

**What**: Semantic regions (`header`, `nav`, `main`, `footer`) that screen readers announce and allow quick navigation.

**Why discoverable**: Screen reader users use landmark navigation (NVDA: D key, VoiceOver: rotor).

**Files:** `docs/index.html`

---

### 4. ARIA Live Regions (WCAG 4.1.3 - Level AA)

**What**: Announce dynamic content changes (search results count) to screen readers automatically.

**Why discoverable**: Automatic - screen readers announce changes without user action.

**Files:** `docs/index.html`, `docs/assets/css/main.css`, `docs/assets/js/modes/*.js`

---

### 5. Reduced Motion Support (WCAG 2.3.3 - Level AAA)

**What**: Respect user's OS preference for reduced motion.

**Why discoverable**: Automatic - OS setting is inherited via `prefers-reduced-motion` media query.

**Files:** `docs/assets/css/main.css`

---

### 6. Keyboard Shortcuts with Help Modal

**What**: Keyboard shortcuts for power users, with a discoverable help modal.

**Why discoverable**:
- `?` to show help is a standard pattern (Gmail, GitHub, YouTube)
- Shortcuts shown in a visible help modal

| Key | Action |
|-----|--------|
| `?` | Show keyboard shortcuts help |
| `/` | Focus search input |
| `Escape` | Close modal / Clear search |
| `1`-`4` | Switch modes (Search/Browse/Added/Removed) |
| `t` | Cycle themes |
| `+`/`-` | Increase/decrease text size |

**Files:** `docs/index.html`, `docs/assets/js/core/keyboard.js`, `docs/assets/css/main.css`

---

### 7. Focus Trap for Modals (WCAG 2.4.3)

**What**: Keep focus inside modal when open, return focus when closed.

**Why discoverable**: Automatic - keyboard users expect Tab to stay in modal.

---

### 8. Visible Help/Accessibility Link

**What**: Small visible indicator showing keyboard shortcut hint exists.

**Why discoverable**: Visible to all users in the UI.

---

## Implementation Order

1. **Core Navigation**: Skip link, ARIA landmarks, enhanced focus indicators
2. **Screen Reader Support**: ARIA live regions, status announcer
3. **Preferences**: Reduced motion support
4. **Power User Features**: Keyboard shortcuts, help modal, focus trap

---

## WCAG Compliance Summary

| Feature | WCAG | Level | Status |
|---------|------|-------|--------|
| Text resize | 1.4.4 | AA | Complete |
| Contrast | 1.4.3 | AA | Complete |
| High contrast | 1.4.6 | AAA | Complete |
| Form labels | 1.3.1 | A | Complete |
| Heading hierarchy | 1.3.1 | A | Complete |
| Skip link | 2.4.1 | A | Phase 2 |
| Focus visible | 2.4.7 | AA | Phase 2 |
| Landmarks | 1.3.1 | A | Phase 2 |
| Live regions | 4.1.3 | AA | Phase 2 |
| Reduced motion | 2.3.3 | AAA | Phase 2 |
| Keyboard access | 2.1.1 | A | Phase 2 |

---

## Design Principles

1. **Automatic when possible** - Reduced motion, live regions, landmarks work without user action
2. **Standard patterns** - Skip link, `?` for help, `/` for search are industry standards
3. **Progressive enhancement** - Site works without JS, shortcuts are enhancements
4. **Visible hints** - Keyboard hint shows shortcuts exist
5. **Respect preferences** - OS settings for motion/contrast honored
