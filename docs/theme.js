class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'auto';
        this.init();
    }

    init() {
        this.applyTheme();
        this.setupEventListeners();
        this.updateButtonStates();

        // Listen for OS theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (this.theme === 'auto') {
                    this.applyTheme();
                }
            });
        }
    }

    setupEventListeners() {
        const buttons = document.querySelectorAll('.theme-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.getAttribute('data-theme');
                this.setTheme(theme);
            });
        });
    }

    setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme();
        this.updateButtonStates();
    }

    applyTheme() {
        const root = document.documentElement;

        if (this.theme === 'auto') {
            // Remove data-theme attribute to let CSS media query handle it
            root.removeAttribute('data-theme');
        } else {
            // Set explicit theme
            root.setAttribute('data-theme', this.theme);
        }
    }

    updateButtonStates() {
        const buttons = document.querySelectorAll('.theme-btn');
        buttons.forEach(btn => {
            const btnTheme = btn.getAttribute('data-theme');
            if (btnTheme === this.theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Helper method to get current effective theme
    getCurrentTheme() {
        if (this.theme !== 'auto') {
            return this.theme;
        }

        // Check what the OS preference is
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }
}

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager = new ThemeManager();
    });
} else {
    window.themeManager = new ThemeManager();
}