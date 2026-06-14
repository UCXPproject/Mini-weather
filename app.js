// Mini Weather - Production App
// Features: WeatherAPI.com (primary), Open-Meteo, NWS, wttr.in fallbacks
// Virtual Garden, 50+ Themes, Push Notifications, Mobile/Desktop Optimized

'use strict';

class WeatherApp {
    constructor() {
        // ── State ──────────────────────────────────────────────────────────
        this.currentLocation  = null;
        this.currentWeather   = null;
        this.locationName     = '';
        this.unit             = localStorage.getItem('mini-weather-unit')   || 'C';
        this.apiSource        = localStorage.getItem('mini-weather-api')    || 'weatherapi';
        this.theme            = localStorage.getItem('mini-weather-theme')  || 'dark';
        this.streak           = parseInt(localStorage.getItem('mini-weather-streak') || '0');
        this.lastCheckDate    = localStorage.getItem('mini-weather-last-check') || '';
        this.gardenMonth      = localStorage.getItem('mini-weather-garden-month') || '';
        this.gardenScore      = parseInt(localStorage.getItem('mini-weather-garden-score') || '0');
        this.gardenChecks     = parseInt(localStorage.getItem('mini-weather-garden-checks') || '0');
        this.notifEnabled     = localStorage.getItem('mini-weather-notifications') === 'true';
        this.cache            = new Map();
        this.cacheTime        = 10 * 60 * 1000; // 10 min
        this.updateInterval   = null;
        this.locationCache    = new Map();

        // ── APIs ───────────────────────────────────────────────────────────
        this.apis = {
            'weatherapi': {
                name: 'WeatherAPI.com',
                desc: 'Primary — most accurate, global, 14-day forecast',
                badge: 'PRIMARY',
                fetch: (lat, lon) => this.fetchWeatherAPI(lat, lon)
            },
            'open-meteo': {
                name: 'Open-Meteo',
                desc: 'Free, no API key, excellent accuracy',
                badge: '',
                fetch: (lat, lon) => this.fetchOpenMeteo(lat, lon)
            },
            'nws': {
                name: 'National Weather Service',
                desc: 'US only — official government data',
                badge: 'US ONLY',
                fetch: (lat, lon) => this.fetchNWS(lat, lon)
            },
            'wttr': {
                name: 'wttr.in',
                desc: 'Fast, simple, global coverage',
                badge: '',
                fetch: (lat, lon) => this.fetchWttr(lat, lon)
            }
        };

        // ── 50+ Themes ─────────────────────────────────────────────────────
        this.themes = {
            // Minimalist
            'dark':              { name: 'Dark',              cat: 'Minimalist', bg: '#0a0a0a', bgAlt: '#1a1a1a', text: '#ffffff', accent: '#1e88e5', border: '#2a2a2a' },
            'light':             { name: 'Light',             cat: 'Minimalist', bg: '#f8f9fa', bgAlt: '#ffffff', text: '#1a1a1a', accent: '#1e88e5', border: '#e0e0e0' },
            'monochrome':        { name: 'Monochrome',        cat: 'Minimalist', bg: '#111111', bgAlt: '#222222', text: '#e8e8e8', accent: '#888888', border: '#333333' },
            'grayscale':         { name: 'Grayscale',         cat: 'Minimalist', bg: '#1c1c1c', bgAlt: '#2c2c2c', text: '#d0d0d0', accent: '#a0a0a0', border: '#3c3c3c' },
            'minimalist-dark':   { name: 'Minimalist Dark',   cat: 'Minimalist', bg: '#0d0d0d', bgAlt: '#181818', text: '#f0f0f0', accent: '#ffffff', border: '#2a2a2a' },
            'minimalist-light':  { name: 'Minimalist Light',  cat: 'Minimalist', bg: '#ffffff', bgAlt: '#f5f5f5', text: '#111111', accent: '#000000', border: '#e8e8e8' },
            // Nature
            'forest':            { name: 'Forest',            cat: 'Nature',     bg: '#0a1a0a', bgAlt: '#1a3a1a', text: '#c8e6c9', accent: '#4caf50', border: '#2a4a2a' },
            'ocean':             { name: 'Ocean',             cat: 'Nature',     bg: '#0a1628', bgAlt: '#1a3a52', text: '#e0f2f1', accent: '#00bcd4', border: '#1a3a52' },
            'sunset':            { name: 'Sunset',            cat: 'Nature',     bg: '#1a0a0a', bgAlt: '#3a1a0a', text: '#ffe0b2', accent: '#ff6f00', border: '#3a1a0a' },
            'sunrise':           { name: 'Sunrise',           cat: 'Nature',     bg: '#1a0f00', bgAlt: '#2e1a00', text: '#fff3e0', accent: '#ff8f00', border: '#3a2000' },
            'meadow':            { name: 'Meadow',            cat: 'Nature',     bg: '#0f1a0a', bgAlt: '#1e3010', text: '#dcedc8', accent: '#8bc34a', border: '#2a3a18' },
            'desert':            { name: 'Desert',            cat: 'Nature',     bg: '#1a1200', bgAlt: '#2e2000', text: '#fff8e1', accent: '#ffa000', border: '#3a2e00' },
            'jungle':            { name: 'Jungle',            cat: 'Nature',     bg: '#001a0a', bgAlt: '#002e14', text: '#b9f6ca', accent: '#00c853', border: '#003a1a' },
            'mountain':          { name: 'Mountain',          cat: 'Nature',     bg: '#0a0f1a', bgAlt: '#141e2e', text: '#cfd8dc', accent: '#607d8b', border: '#1e2a3a' },
            'glacier':           { name: 'Glacier',           cat: 'Nature',     bg: '#0a1520', bgAlt: '#102030', text: '#e3f2fd', accent: '#81d4fa', border: '#1a2a3a' },
            // Gems
            'ruby':              { name: 'Ruby',              cat: 'Gems',       bg: '#1a0000', bgAlt: '#2e0000', text: '#ffcdd2', accent: '#f44336', border: '#3a0000' },
            'sapphire':          { name: 'Sapphire',          cat: 'Gems',       bg: '#00001a', bgAlt: '#00002e', text: '#e3f2fd', accent: '#1565c0', border: '#00003a' },
            'emerald':           { name: 'Emerald',           cat: 'Gems',       bg: '#001a0a', bgAlt: '#002e14', text: '#e8f5e9', accent: '#2e7d32', border: '#003a1a' },
            'amethyst':          { name: 'Amethyst',          cat: 'Gems',       bg: '#0f001a', bgAlt: '#1e002e', text: '#f3e5f5', accent: '#7b1fa2', border: '#2a003a' },
            'topaz':             { name: 'Topaz',             cat: 'Gems',       bg: '#1a1000', bgAlt: '#2e1c00', text: '#fff8e1', accent: '#f9a825', border: '#3a2800' },
            'pearl':             { name: 'Pearl',             cat: 'Gems',       bg: '#f5f5f0', bgAlt: '#eeeeea', text: '#2a2a2a', accent: '#9e9e9e', border: '#d0d0cc' },
            'jade':              { name: 'Jade',              cat: 'Gems',       bg: '#001a12', bgAlt: '#002e20', text: '#e0f2f1', accent: '#00897b', border: '#003a28' },
            'opal':              { name: 'Opal',              cat: 'Gems',       bg: '#0a0a1a', bgAlt: '#14142e', text: '#e8eaf6', accent: '#7986cb', border: '#1e1e3a' },
            'diamond':           { name: 'Diamond',           cat: 'Gems',       bg: '#f0f4f8', bgAlt: '#e8edf2', text: '#1a2a3a', accent: '#4fc3f7', border: '#c8d4e0' },
            // Metals
            'gold':              { name: 'Gold',              cat: 'Metals',     bg: '#1a1200', bgAlt: '#2e2000', text: '#fff8e1', accent: '#ffd600', border: '#3a2e00' },
            'silver':            { name: 'Silver',            cat: 'Metals',     bg: '#1a1a1a', bgAlt: '#2a2a2a', text: '#f5f5f5', accent: '#bdbdbd', border: '#3a3a3a' },
            'bronze':            { name: 'Bronze',            cat: 'Metals',     bg: '#1a0e00', bgAlt: '#2e1c00', text: '#ffe0b2', accent: '#bf8040', border: '#3a2800' },
            'copper':            { name: 'Copper',            cat: 'Metals',     bg: '#1a0800', bgAlt: '#2e1200', text: '#ffd7c4', accent: '#bf6040', border: '#3a1800' },
            'platinum':          { name: 'Platinum',          cat: 'Metals',     bg: '#0f1214', bgAlt: '#1a1e22', text: '#e8ecf0', accent: '#90a4ae', border: '#2a2e32' },
            'iron':              { name: 'Iron',              cat: 'Metals',     bg: '#0e0e10', bgAlt: '#1c1c20', text: '#d0d0d8', accent: '#78909c', border: '#2c2c30' },
            'steel':             { name: 'Steel',             cat: 'Metals',     bg: '#0a0e12', bgAlt: '#141c24', text: '#cfd8dc', accent: '#546e7a', border: '#1e2a32' },
            // Moods
            'calm':              { name: 'Calm',              cat: 'Moods',      bg: '#0a1520', bgAlt: '#102030', text: '#e0f0ff', accent: '#4fc3f7', border: '#1a2a3a' },
            'energetic':         { name: 'Energetic',         cat: 'Moods',      bg: '#1a0000', bgAlt: '#2e0a00', text: '#fff3e0', accent: '#ff5722', border: '#3a1000' },
            'cozy':              { name: 'Cozy',              cat: 'Moods',      bg: '#1a0f00', bgAlt: '#2e1c00', text: '#fff8e1', accent: '#ff8f00', border: '#3a2800' },
            'mysterious':        { name: 'Mysterious',        cat: 'Moods',      bg: '#0a0014', bgAlt: '#140028', text: '#e8d5ff', accent: '#9c27b0', border: '#1e003a' },
            'ethereal':          { name: 'Ethereal',          cat: 'Moods',      bg: '#0a0a1e', bgAlt: '#14143a', text: '#e8e8ff', accent: '#7c4dff', border: '#1e1e4a' },
            'dreamy':            { name: 'Dreamy',            cat: 'Moods',      bg: '#1a0a1a', bgAlt: '#2e1a2e', text: '#fce4ec', accent: '#f06292', border: '#3a1a3a' },
            'vibrant':           { name: 'Vibrant',           cat: 'Moods',      bg: '#0a0a0a', bgAlt: '#1a1a1a', text: '#ffffff', accent: '#ff4081', border: '#2a2a2a' },
            'serene':            { name: 'Serene',            cat: 'Moods',      bg: '#0a1a14', bgAlt: '#142a20', text: '#e0f2f1', accent: '#26a69a', border: '#1a2e28' },
            // Popular
            'nord':              { name: 'Nord',              cat: 'Popular',    bg: '#2e3440', bgAlt: '#3b4252', text: '#eceff4', accent: '#88c0d0', border: '#4c566a' },
            'dracula':           { name: 'Dracula',           cat: 'Popular',    bg: '#282a36', bgAlt: '#44475a', text: '#f8f8f2', accent: '#ff79c6', border: '#6272a4' },
            'gruvbox':           { name: 'Gruvbox',           cat: 'Popular',    bg: '#282828', bgAlt: '#3c3836', text: '#ebdbb2', accent: '#fe8019', border: '#504945' },
            'solarized':         { name: 'Solarized',         cat: 'Popular',    bg: '#002b36', bgAlt: '#073642', text: '#93a1a1', accent: '#268bd2', border: '#0d4a5a' },
            'cyberpunk':         { name: 'Cyberpunk',         cat: 'Popular',    bg: '#0d0221', bgAlt: '#1a0033', text: '#ff006e', accent: '#00f5ff', border: '#2a0044' },
            'synthwave':         { name: 'Synthwave',         cat: 'Popular',    bg: '#0d0221', bgAlt: '#1e0a3a', text: '#ff71ce', accent: '#b967ff', border: '#2a1050' },
            'vaporwave':         { name: 'Vaporwave',         cat: 'Popular',    bg: '#1a0a2e', bgAlt: '#2e1a4a', text: '#ff71ce', accent: '#01cdfe', border: '#3a2060' },
            // Seasonal
            'spring':            { name: 'Spring',            cat: 'Seasonal',   bg: '#0a1a0a', bgAlt: '#142a14', text: '#f1f8e9', accent: '#7cb342', border: '#1e3a1e' },
            'summer':            { name: 'Summer',            cat: 'Seasonal',   bg: '#1a1000', bgAlt: '#2e1e00', text: '#fff9c4', accent: '#fdd835', border: '#3a2c00' },
            'autumn':            { name: 'Autumn',            cat: 'Seasonal',   bg: '#1a0800', bgAlt: '#2e1200', text: '#ffe0b2', accent: '#e65100', border: '#3a1800' },
            'winter':            { name: 'Winter',            cat: 'Seasonal',   bg: '#0a1020', bgAlt: '#101828', text: '#e3f2fd', accent: '#90caf9', border: '#1a2030' },
            // Neon
            'neon-pink':         { name: 'Neon Pink',         cat: 'Neon',       bg: '#0a0010', bgAlt: '#14001e', text: '#ff80ab', accent: '#ff4081', border: '#1e0028' },
            'neon-blue':         { name: 'Neon Blue',         cat: 'Neon',       bg: '#000a1a', bgAlt: '#00142e', text: '#80d8ff', accent: '#00b0ff', border: '#001e3a' },
            'neon-green':        { name: 'Neon Green',        cat: 'Neon',       bg: '#001a00', bgAlt: '#002e00', text: '#b9f6ca', accent: '#00e676', border: '#003a00' },
            'neon-purple':       { name: 'Neon Purple',       cat: 'Neon',       bg: '#0a0014', bgAlt: '#140028', text: '#ea80fc', accent: '#e040fb', border: '#1e003a' },
            // Custom
            'retro':             { name: 'Retro',             cat: 'Custom',     bg: '#1a1400', bgAlt: '#2e2400', text: '#ffff00', accent: '#ff6600', border: '#3a3000' },
            'vintage':           { name: 'Vintage',           cat: 'Custom',     bg: '#1a1208', bgAlt: '#2e2010', text: '#f5e6c8', accent: '#c8a060', border: '#3a2e18' },
            'modern':            { name: 'Modern',            cat: 'Custom',     bg: '#0f0f0f', bgAlt: '#1e1e1e', text: '#f0f0f0', accent: '#2979ff', border: '#2e2e2e' },
            'futuristic':        { name: 'Futuristic',        cat: 'Custom',     bg: '#000a14', bgAlt: '#001428', text: '#00e5ff', accent: '#00b0ff', border: '#001e3a' },
            'warm':              { name: 'Warm',              cat: 'Custom',     bg: '#1a0f00', bgAlt: '#2e1c00', text: '#fff3e0', accent: '#ff9800', border: '#3a2800' },
            'cool':              { name: 'Cool',              cat: 'Custom',     bg: '#0a1a2a', bgAlt: '#142a3a', text: '#e3f2fd', accent: '#2196f3', border: '#1e2e3a' },
            'pastel':            { name: 'Pastel',            cat: 'Custom',     bg: '#faf8f3', bgAlt: '#f5f3ee', text: '#5a5a5a', accent: '#ff9999', border: '#e8e4dc' },
            'coffee':            { name: 'Coffee',            cat: 'Custom',     bg: '#1a0f0a', bgAlt: '#2e1e14', text: '#d7ccc8', accent: '#795548', border: '#3a2a20' },
            'lavender':          { name: 'Lavender',          cat: 'Custom',     bg: '#1a0a2e', bgAlt: '#2a1a4e', text: '#e1bee7', accent: '#9c27b0', border: '#3a1a5a' },
            'berry':             { name: 'Berry',             cat: 'Custom',     bg: '#1a0010', bgAlt: '#2e0020', text: '#fce4ec', accent: '#e91e63', border: '#3a0030' },
            'mint':              { name: 'Mint',              cat: 'Custom',     bg: '#001a14', bgAlt: '#002e22', text: '#e0f2f1', accent: '#009688', border: '#003a2a' },
        };

        // ── Init ───────────────────────────────────────────────────────────
        this.applyTheme(this.theme);
        this.initEventListeners();
        this.registerServiceWorker();
        this.updateStreak();
        this.checkGardenReset();
        this.updateNotifyButton();
    }

    // ════════════════════════════════════════════════════════════════════════
    // THEME
    // ════════════════════════════════════════════════════════════════════════

    applyTheme(name) {
        const t = this.themes[name];
        if (!t) return;
        const r = document.documentElement.style;
        r.setProperty('--bg',           t.bg);
        r.setProperty('--bg-alt',       t.bgAlt);
        r.setProperty('--text',         t.text);
        r.setProperty('--accent',       t.accent);
        r.setProperty('--border',       t.border || '#2a2a2a');
        r.setProperty('--border-light', t.border || '#333333');
        r.setProperty('--accent-glow',  this._hexToRgba(t.accent, 0.25));
        // Derive text-dim and text-muted from text color
        r.setProperty('--text-dim',     this._adjustAlpha(t.text, 0.65));
        r.setProperty('--text-muted',   this._adjustAlpha(t.text, 0.38));
        this.theme = name;
        localStorage.setItem('mini-weather-theme', name);
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.accent);
    }

    _hexToRgba(hex, alpha) {
        try {
            const r = parseInt(hex.slice(1,3),16);
            const g = parseInt(hex.slice(3,5),16);
            const b = parseInt(hex.slice(5,7),16);
            return `rgba(${r},${g},${b},${alpha})`;
        } catch { return `rgba(30,136,229,${alpha})`; }
    }

    _adjustAlpha(hex, alpha) {
        // Returns a semi-transparent version of the text color
        try {
            const r = parseInt(hex.slice(1,3),16);
            const g = parseInt(hex.slice(3,5),16);
            const b = parseInt(hex.slice(5,7),16);
            return `rgba(${r},${g},${b},${alpha})`;
        } catch { return alpha > 0.5 ? '#b0b0b0' : '#666666'; }
    }

    // ════════════════════════════════════════════════════════════════════════
    // STREAK & GARDEN RESET
    // ════════════════════════════════════════════════════════════════════════

    updateStreak() {
        const today = new Date().toDateString();
        if (this.lastCheckDate !== today) {
            this.lastCheckDate = today;
            this.streak++;
            localStorage.setItem('mini-weather-streak', this.streak);
            localStorage.setItem('mini-weather-last-check', today);
        }
        const el = document.getElementById('streak-count');
        if (el) el.textContent = this.streak;
    }

    checkGardenReset() {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
        if (this.gardenMonth !== currentMonth) {
            this.gardenMonth  = currentMonth;
            this.gardenScore  = 0;
            this.gardenChecks = 0;
            localStorage.setItem('mini-weather-garden-month',  this.gardenMonth);
            localStorage.setItem('mini-weather-garden-score',  '0');
            localStorage.setItem('mini-weather-garden-checks', '0');
        }
        // Update reset info
        const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const daysLeft  = Math.ceil((nextReset - now) / (1000 * 60 * 60 * 24));
        const el = document.getElementById('garden-reset-info');
        if (el) el.textContent = `Garden resets in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} • ${this.gardenChecks} check${this.gardenChecks !== 1 ? 's' : ''} this month`;
    }

    // ════════════════════════════════════════════════════════════════════════
    // EVENT LISTENERS
    // ════════════════════════════════════════════════════════════════════════

    initEventListeners() {
        document.getElementById('location-btn').addEventListener('click', () => this.requestLocation());
        document.getElementById('refresh-btn').addEventListener('click',  () => this.refresh());
        document.getElementById('unit-btn').addEventListener('click',     () => this.toggleUnit());
        document.getElementById('api-btn').addEventListener('click',      () => this.showAPIModal());
        document.getElementById('theme-btn').addEventListener('click',    () => this.showThemeModal());
        document.getElementById('notify-btn').addEventListener('click',   () => this.requestNotifications());

        // Modal close buttons
        document.getElementById('api-modal-close').addEventListener('click',   () => this.closeAPIModal());
        document.getElementById('theme-modal-close').addEventListener('click', () => this.closeThemeModal());

        // Modal backdrop close
        document.getElementById('api-modal').addEventListener('click',   e => { if (e.target.id === 'api-modal')   this.closeAPIModal(); });
        document.getElementById('theme-modal').addEventListener('click', e => { if (e.target.id === 'theme-modal') this.closeThemeModal(); });

        // Theme search
        document.getElementById('theme-search').addEventListener('input', e => this.filterThemes(e.target.value));

        // Keyboard: Escape closes modals
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { this.closeAPIModal(); this.closeThemeModal(); }
        });

        // Visibility change: refresh when tab becomes active
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentLocation) {
                const cacheKey = this._cacheKey();
                const cached   = this.cache.get(cacheKey);
                if (!cached || Date.now() - cached.time > this.cacheTime) {
                    this.fetchWeather();
                }
            }
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // SERVICE WORKER
    // ════════════════════════════════════════════════════════════════════════

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.warn('SW registration failed:', err);
            });
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ════════════════════════════════════════════════════════════════════════

    updateNotifyButton() {
        const btn = document.getElementById('notify-btn');
        if (!btn) return;
        if (this.notifEnabled && Notification?.permission === 'granted') {
            btn.classList.add('notify-active');
            btn.title = 'Notifications enabled';
        } else {
            btn.classList.remove('notify-active');
            btn.title = 'Enable Notifications';
        }
    }

    async requestNotifications() {
        if (!('Notification' in window)) {
            this._toast('Notifications not supported on this device');
            return;
        }
        if (Notification.permission === 'denied') {
            this._toast('Notifications blocked — please enable in browser settings');
            return;
        }
        if (Notification.permission === 'granted') {
            this.notifEnabled = true;
            localStorage.setItem('mini-weather-notifications', 'true');
            this.updateNotifyButton();
            this.sendNotification('Mini Weather', { body: 'Notifications are already enabled! ✅', tag: 'setup' });
            return;
        }
        try {
            const perm = await Notification.requestPermission();
            this.notifEnabled = perm === 'granted';
            localStorage.setItem('mini-weather-notifications', this.notifEnabled ? 'true' : 'false');
            this.updateNotifyButton();
            if (this.notifEnabled) {
                this.sendNotification('Mini Weather', {
                    body: "Weather alerts enabled! You'll be notified of extreme conditions. 🌤️",
                    tag: 'setup'
                });
            }
        } catch (err) {
            console.warn('Notification permission error:', err);
        }
    }

    sendNotification(title, options = {}) {
        if (!this.notifEnabled || Notification?.permission !== 'granted') return;
        const defaults = {
            icon:    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%231e88e5' width='64' height='64' rx='12'/><text x='50%' y='54%' font-size='40' dominant-baseline='middle' text-anchor='middle'>🌤️</text></svg>",
            badge:   "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%231e88e5' width='64' height='64' rx='12'/><text x='50%' y='54%' font-size='40' dominant-baseline='middle' text-anchor='middle'>🌤️</text></svg>",
            vibrate: [200, 100, 200],
            ...options
        };
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, options: defaults });
            } else {
                new Notification(title, defaults);
            }
        } catch (err) {
            console.warn('Notification send error:', err);
        }
    }

    checkWeatherAlerts(current, daily) {
        if (!this.notifEnabled) return;
        const alerts = [];

        // Extreme UV
        if ((current.uvIndex || 0) >= 11) {
            alerts.push({ title: '☀️ Extreme UV Alert', body: `UV Index ${Math.round(current.uvIndex)} — Stay indoors or use maximum protection`, tag: 'uv-extreme', severity: 'danger' });
        } else if ((current.uvIndex || 0) >= 8) {
            alerts.push({ title: '☀️ Very High UV', body: `UV Index ${Math.round(current.uvIndex)} — Wear sunscreen and protective clothing`, tag: 'uv-high', severity: 'warning' });
        }

        // Wind warnings
        if ((current.windSpeed || 0) > 60) {
            alerts.push({ title: '💨 Severe Wind Warning', body: `Wind speed ${Math.round(current.windSpeed)} km/h — Dangerous conditions`, tag: 'wind-severe', severity: 'danger' });
        } else if ((current.windSpeed || 0) > 40) {
            alerts.push({ title: '💨 Strong Wind Alert', body: `Wind speed ${Math.round(current.windSpeed)} km/h — Exercise caution outdoors`, tag: 'wind-strong', severity: 'warning' });
        }

        // Rain alerts
        if (daily?.[0]?.precipChance > 85) {
            alerts.push({ title: '⛈️ Heavy Rain Expected', body: `${daily[0].precipChance}% chance of heavy rain today`, tag: 'rain-heavy', severity: 'warning' });
        }

        // Temperature extremes
        if ((current.temp || 0) >= 40) {
            alerts.push({ title: '🌡️ Extreme Heat', body: `Temperature ${Math.round(current.temp)}°C — Heat stroke risk, stay hydrated`, tag: 'heat-extreme', severity: 'danger' });
        } else if ((current.temp || 0) <= -10) {
            alerts.push({ title: '❄️ Extreme Cold', body: `Temperature ${Math.round(current.temp)}°C — Frostbite risk, dress warmly`, tag: 'cold-extreme', severity: 'danger' });
        } else if ((current.temp || 0) <= 0) {
            alerts.push({ title: '❄️ Freezing Conditions', body: `Temperature ${Math.round(current.temp)}°C — Watch for ice on roads`, tag: 'freezing', severity: 'warning' });
        }

        // Send only the most severe alert (avoid notification spam)
        const danger = alerts.find(a => a.severity === 'danger');
        const toSend = danger || alerts[0];
        if (toSend) {
            this.sendNotification(toSend.title, { body: toSend.body, tag: toSend.tag, requireInteraction: toSend.severity === 'danger' });
        }
    }

    _toast(msg) {
        // Simple inline toast — no external deps
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 18px;border-radius:8px;font-size:0.82rem;z-index:9999;max-width:90vw;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);animation:fadeIn 0.2s ease';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }

    // ════════════════════════════════════════════════════════════════════════
    // LOCATION
    // ════════════════════════════════════════════════════════════════════════

    async requestLocation() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by your browser.');
            return;
        }
        const btn = document.getElementById('location-btn');
        btn.disabled = true;
        btn.textContent = '⏳';

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 60000
                });
            });
            const { latitude, longitude } = position.coords;
            this.currentLocation = { latitude, longitude };
            localStorage.setItem('mini-weather-location', JSON.stringify(this.currentLocation));
            await this.fetchWeather();
            this.startAutoUpdate();
        } catch (err) {
            let msg = 'Location access denied.';
            if (err.code === 1) msg = 'Location access denied. Please enable location permissions in your browser settings.';
            else if (err.code === 2) msg = 'Location unavailable. Please check your device GPS or network.';
            else if (err.code === 3) msg = 'Location request timed out. Please try again.';
            this.showError(msg);
        } finally {
            btn.disabled = false;
            btn.textContent = '📍';
        }
    }

    startAutoUpdate() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            if (!document.hidden && this.currentLocation) this.fetchWeather();
        }, 5 * 60 * 1000);
    }

    // ════════════════════════════════════════════════════════════════════════
    // WEATHER FETCH ORCHESTRATION
    // ════════════════════════════════════════════════════════════════════════

    _cacheKey() {
        if (!this.currentLocation) return '';
        const { latitude, longitude } = this.currentLocation;
        return `${latitude.toFixed(3)}-${longitude.toFixed(3)}-${this.apiSource}`;
    }

    async fetchWeather() {
        if (!this.currentLocation) { this.showError('No location selected. Click 📍 to get started.'); return; }

        const cacheKey = this._cacheKey();
        const cached   = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.time < this.cacheTime) {
            this.currentWeather = cached.data;
            this.render();
            return;
        }

        this.showLoading();

        const api = this.apis[this.apiSource];
        if (!api) { this.showError(`Unknown API source: ${this.apiSource}`); return; }

        try {
            const weather = await api.fetch(this.currentLocation.latitude, this.currentLocation.longitude);
            this.currentWeather = weather;
            this.cache.set(cacheKey, { data: weather, time: Date.now() });
            this.render();
        } catch (err) {
            console.error('Weather fetch error:', err);
            // Try fallback to Open-Meteo if primary fails
            if (this.apiSource !== 'open-meteo') {
                try {
                    const fallback = await this.fetchOpenMeteo(this.currentLocation.latitude, this.currentLocation.longitude);
                    this.currentWeather = fallback;
                    this.cache.set(cacheKey, { data: fallback, time: Date.now() });
                    this.render();
                    this._toast('Primary API unavailable — using Open-Meteo fallback');
                    return;
                } catch (fallbackErr) {
                    console.error('Fallback also failed:', fallbackErr);
                }
            }
            this.showError(this._friendlyError(err));
        }
    }

    _friendlyError(err) {
        const msg = err?.message || '';
        if (msg.includes('timeout') || msg.includes('AbortError')) return 'Request timed out. Check your internet connection and try again.';
        if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) return 'Network error. Please check your internet connection.';
        if (msg.includes('403') || msg.includes('401')) return 'API authentication error. Please try a different data source.';
        if (msg.includes('429')) return 'Too many requests. Please wait a moment and try again.';
        return `Failed to fetch weather data: ${msg || 'Unknown error'}`;
    }

    // ════════════════════════════════════════════════════════════════════════
    // WEATHERAPI.COM (PRIMARY)
    // ════════════════════════════════════════════════════════════════════════

    async fetchWeatherAPI(lat, lon) {
        const KEY = 'd2cbbf50a55542749d8151557260406';
        const url = `https://api.weatherapi.com/v1/forecast.json?key=${KEY}&q=${lat},${lon}&days=14&aqi=yes&alerts=yes`;

        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(`WeatherAPI ${response.status}: ${errData?.error?.message || response.statusText}`);
            }
            const data = await response.json();
            return this.normalizeWeatherAPI(data);
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') throw new Error('WeatherAPI request timed out');
            throw err;
        }
    }

    normalizeWeatherAPI(data) {
        const cur  = data.current;
        const loc  = data.location;
        const fore = data.forecast?.forecastday || [];

        // Build hourly from all forecast days
        const hourly = [];
        fore.forEach(day => {
            (day.hour || []).forEach(h => {
                hourly.push({
                    time:          h.time,
                    temp:          h.temp_c,
                    code:          h.condition?.code || 0,
                    description:   h.condition?.text || '',
                    icon:          this._wapiIcon(h.condition?.code, h.is_day),
                    precipitation: h.chance_of_rain || 0,
                    wind:          h.wind_kph || 0,
                    humidity:      h.humidity || 0,
                    feelsLike:     h.feelslike_c || h.temp_c,
                    uvIndex:       h.uv || 0
                });
            });
        });

        // Build daily
        const daily = fore.map(day => {
            const d = day.day;
            return {
                date:        day.date,
                code:        d.condition?.code || 0,
                description: d.condition?.text || '',
                icon:        this._wapiIcon(d.condition?.code, 1),
                maxTemp:     d.maxtemp_c,
                minTemp:     d.mintemp_c,
                precipitation: d.totalprecip_mm || 0,
                precipChance:  d.daily_chance_of_rain || 0,
                wind:          d.maxwind_kph || 0,
                uvIndex:       d.uv || 0,
                sunrise:       day.astro?.sunrise || '',
                sunset:        day.astro?.sunset  || '',
                moonPhase:     day.astro?.moon_phase || '',
                humidity:      d.avghumidity || 0
            };
        });

        // Air quality
        const aqi = cur.air_quality;
        const aqiIndex = aqi ? Math.round(aqi['us-epa-index'] || 0) : null;

        return {
            source:   'WeatherAPI.com',
            location: { latitude: loc.lat, longitude: loc.lon, timezone: loc.tz_id, name: `${loc.name}, ${loc.country}` },
            current: {
                temp:        cur.temp_c,
                code:        cur.condition?.code || 0,
                description: cur.condition?.text || 'Unknown',
                icon:        this._wapiIcon(cur.condition?.code, cur.is_day),
                humidity:    cur.humidity,
                windSpeed:   cur.wind_kph,
                windGusts:   cur.gust_kph || cur.wind_kph,
                windDir:     cur.wind_dir || '',
                windDeg:     cur.wind_degree || 0,
                feelsLike:   cur.feelslike_c,
                pressure:    cur.pressure_mb,
                visibility:  cur.vis_km,
                uvIndex:     cur.uv,
                cloudCover:  cur.cloud,
                precipitation: cur.precip_mm || 0,
                dewPoint:    cur.dewpoint_c || 0,
                isDay:       cur.is_day === 1,
                aqiIndex,
                aqiLabel:    aqiIndex ? this._aqiLabel(aqiIndex) : null
            },
            hourly: hourly.slice(0, 48),
            daily,
            alerts: (data.alerts?.alert || []).map(a => ({
                headline: a.headline,
                severity: a.severity,
                desc:     a.desc,
                expires:  a.expires
            }))
        };
    }

    _wapiIcon(code, isDay) {
        if (!code) return isDay ? '☀️' : '🌙';
        // WeatherAPI condition codes → emoji
        if (code === 1000) return isDay ? '☀️' : '🌙';
        if ([1003, 1006].includes(code)) return isDay ? '⛅' : '🌤️';
        if (code === 1009) return '☁️';
        if ([1030, 1135, 1147].includes(code)) return '🌫️';
        if ([1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code)) return '🌧️';
        if ([1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code)) return '❄️';
        if ([1087, 1273, 1276, 1279, 1282].includes(code)) return '⛈️';
        return '🌡️';
    }

    _aqiLabel(index) {
        const labels = ['', 'Good', 'Moderate', 'Unhealthy for Sensitive', 'Unhealthy', 'Very Unhealthy', 'Hazardous'];
        return labels[index] || 'Unknown';
    }

    // ════════════════════════════════════════════════════════════════════════
    // OPEN-METEO
    // ════════════════════════════════════════════════════════════════════════

    async fetchOpenMeteo(lat, lon) {
        const params = new URLSearchParams({
            latitude:  lat.toFixed(4),
            longitude: lon.toFixed(4),
            current:   'temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,apparent_temperature,pressure_msl,visibility,uv_index,precipitation,cloud_cover,dew_point_2m,is_day',
            hourly:    'temperature_2m,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m,uv_index,is_day',
            daily:     'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
            timezone:  'auto',
            forecast_days: 14
        });

        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
            clearTimeout(timeout);
            if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
            const data = await response.json();
            return this.normalizeOpenMeteo(data);
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') throw new Error('Open-Meteo request timed out');
            throw err;
        }
    }

    normalizeOpenMeteo(data) {
        const cur    = data.current;
        const hourly = data.hourly;
        const daily  = data.daily;

        return {
            source:   'Open-Meteo',
            location: { latitude: data.latitude, longitude: data.longitude, timezone: data.timezone },
            current: {
                temp:        cur.temperature_2m,
                code:        cur.weather_code,
                description: this._wmoDesc(cur.weather_code),
                icon:        this._wmoIcon(cur.weather_code, cur.is_day),
                humidity:    cur.relative_humidity_2m,
                windSpeed:   cur.wind_speed_10m,
                windGusts:   cur.wind_gusts_10m || cur.wind_speed_10m,
                windDir:     this._degToDir(cur.wind_direction_10m),
                windDeg:     cur.wind_direction_10m || 0,
                feelsLike:   cur.apparent_temperature,
                pressure:    cur.pressure_msl,
                visibility:  (cur.visibility || 0) / 1000,
                uvIndex:     cur.uv_index || 0,
                cloudCover:  cur.cloud_cover || 0,
                precipitation: cur.precipitation || 0,
                dewPoint:    cur.dew_point_2m || 0,
                isDay:       cur.is_day === 1,
                aqiIndex:    null,
                aqiLabel:    null
            },
            hourly: hourly.time.slice(0, 48).map((time, i) => ({
                time,
                temp:          hourly.temperature_2m[i],
                code:          hourly.weather_code[i],
                description:   this._wmoDesc(hourly.weather_code[i]),
                icon:          this._wmoIcon(hourly.weather_code[i], hourly.is_day?.[i] ?? 1),
                precipitation: hourly.precipitation_probability?.[i] || 0,
                wind:          hourly.wind_speed_10m[i],
                humidity:      hourly.relative_humidity_2m[i],
                uvIndex:       hourly.uv_index?.[i] || 0
            })),
            daily: daily.time.map((date, i) => ({
                date,
                code:          daily.weather_code[i],
                description:   this._wmoDesc(daily.weather_code[i]),
                icon:          this._wmoIcon(daily.weather_code[i], 1),
                maxTemp:       daily.temperature_2m_max[i],
                minTemp:       daily.temperature_2m_min[i],
                precipitation: daily.precipitation_sum?.[i] || 0,
                precipChance:  daily.precipitation_probability_max?.[i] || 0,
                wind:          daily.wind_speed_10m_max[i],
                uvIndex:       daily.uv_index_max?.[i] || 0,
                sunrise:       daily.sunrise?.[i] || '',
                sunset:        daily.sunset?.[i]  || '',
                moonPhase:     '',
                humidity:      0
            })),
            alerts: []
        };
    }

    _wmoDesc(code) {
        const map = {
            0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
            45:'Foggy', 48:'Rime fog',
            51:'Light drizzle', 53:'Moderate drizzle', 55:'Dense drizzle',
            61:'Slight rain', 63:'Moderate rain', 65:'Heavy rain',
            71:'Slight snow', 73:'Moderate snow', 75:'Heavy snow', 77:'Snow grains',
            80:'Rain showers', 81:'Heavy showers', 82:'Violent showers',
            85:'Snow showers', 86:'Heavy snow showers',
            95:'Thunderstorm', 96:'Thunderstorm + hail', 99:'Severe thunderstorm'
        };
        return map[code] || 'Unknown';
    }

    _wmoIcon(code, isDay) {
        if (code === 0)  return isDay ? '☀️' : '🌙';
        if (code <= 2)   return isDay ? '⛅' : '🌤️';
        if (code === 3)  return '☁️';
        if (code <= 48)  return '🌫️';
        if (code <= 55)  return '🌦️';
        if (code <= 65)  return '🌧️';
        if (code <= 77)  return '❄️';
        if (code <= 82)  return '🌧️';
        if (code <= 86)  return '🌨️';
        if (code <= 99)  return '⛈️';
        return '🌡️';
    }

    _degToDir(deg) {
        if (deg == null) return '';
        const dirs = ['N','NE','E','SE','S','SW','W','NW'];
        return dirs[Math.round(deg / 45) % 8];
    }

    // ════════════════════════════════════════════════════════════════════════
    // NWS
    // ════════════════════════════════════════════════════════════════════════

    async fetchNWS(lat, lon) {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 10000);

        try {
            const gridRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { signal: controller.signal });
            if (!gridRes.ok) throw new Error('NWS: Location not supported (US only)');
            const gridData = await gridRes.json();

            const foreRes = await fetch(gridData.properties.forecast, { signal: controller.signal });
            if (!foreRes.ok) throw new Error('NWS: Forecast unavailable');
            const foreData = await foreRes.json();

            clearTimeout(timeout);
            return this.normalizeNWS(foreData, lat, lon);
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') throw new Error('NWS request timed out');
            throw err;
        }
    }

    normalizeNWS(data, lat, lon) {
        const periods = data.properties?.periods || [];
        const cur     = periods[0] || {};
        const tempC   = cur.temperatureUnit === 'F' ? (cur.temperature - 32) * 5/9 : cur.temperature;

        return {
            source:   'National Weather Service',
            location: { latitude: lat, longitude: lon, timezone: 'US' },
            current: {
                temp:        tempC,
                code:        0,
                description: cur.shortForecast || 'Unknown',
                icon:        this._wmoIcon(0, cur.isDaytime ? 1 : 0),
                humidity:    cur.relativeHumidity?.value || 50,
                windSpeed:   parseFloat(cur.windSpeed) || 0,
                windGusts:   0,
                windDir:     cur.windDirection || '',
                windDeg:     0,
                feelsLike:   tempC,
                pressure:    1013,
                visibility:  16,
                uvIndex:     5,
                cloudCover:  50,
                precipitation: 0,
                dewPoint:    10,
                isDay:       cur.isDaytime !== false,
                aqiIndex:    null,
                aqiLabel:    null
            },
            hourly: [],
            daily: periods.filter((_, i) => i % 2 === 0).slice(0, 7).map(p => {
                const tc = p.temperatureUnit === 'F' ? (p.temperature - 32) * 5/9 : p.temperature;
                return {
                    date:          p.startTime?.split('T')[0] || '',
                    code:          0,
                    description:   p.shortForecast || '',
                    icon:          this._wmoIcon(0, 1),
                    maxTemp:       tc,
                    minTemp:       tc - 5,
                    precipitation: 0,
                    precipChance:  p.probabilityOfPrecipitation?.value || 0,
                    wind:          parseFloat(p.windSpeed) || 0,
                    uvIndex:       5,
                    sunrise:       '',
                    sunset:        '',
                    moonPhase:     '',
                    humidity:      50
                };
            }),
            alerts: []
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    // WTTR.IN
    // ════════════════════════════════════════════════════════════════════════

    async fetchWttr(lat, lon) {
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`https://wttr.in/${lat},${lon}?format=j1`, { signal: controller.signal });
            clearTimeout(timeout);
            if (!response.ok) throw new Error('wttr.in unavailable');
            const data = await response.json();
            return this.normalizeWttr(data, lat, lon);
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') throw new Error('wttr.in request timed out');
            throw err;
        }
    }

    normalizeWttr(data, lat, lon) {
        const cur  = data.current_condition?.[0] || {};
        const fore = data.weather?.[0] || {};

        return {
            source:   'wttr.in',
            location: { latitude: parseFloat(data.nearest_area?.[0]?.latitude || lat), longitude: parseFloat(data.nearest_area?.[0]?.longitude || lon), timezone: 'UTC' },
            current: {
                temp:        parseFloat(cur.temp_C || 0),
                code:        0,
                description: cur.weatherDesc?.[0]?.value || 'Unknown',
                icon:        this._wmoIcon(0, 1),
                humidity:    parseInt(cur.humidity || 50),
                windSpeed:   parseFloat(cur.windspeedKmph || 0),
                windGusts:   parseFloat(cur.WindGustKmph || 0),
                windDir:     cur.winddir16Point || '',
                windDeg:     parseInt(cur.winddirDegree || 0),
                feelsLike:   parseFloat(cur.FeelsLikeC || cur.temp_C || 0),
                pressure:    parseFloat(cur.pressure || 1013),
                visibility:  parseFloat(cur.visibility || 10),
                uvIndex:     parseInt(cur.uvIndex || 0),
                cloudCover:  parseInt(cur.cloudcover || 0),
                precipitation: parseFloat(cur.precipMM || 0),
                dewPoint:    10,
                isDay:       true,
                aqiIndex:    null,
                aqiLabel:    null
            },
            hourly: (fore.hourly || []).map(h => ({
                time:          `${fore.date} ${h.time?.padStart(4,'0').slice(0,2)}:00`,
                temp:          parseFloat(h.tempC || 0),
                code:          0,
                description:   h.weatherDesc?.[0]?.value || '',
                icon:          this._wmoIcon(0, 1),
                precipitation: parseInt(h.chanceofrain || 0),
                wind:          parseFloat(h.windspeedKmph || 0),
                humidity:      parseInt(h.humidity || 0),
                uvIndex:       parseInt(h.uvIndex || 0)
            })),
            daily: (data.weather || []).map(d => ({
                date:          d.date,
                code:          0,
                description:   d.hourly?.[4]?.weatherDesc?.[0]?.value || '',
                icon:          this._wmoIcon(0, 1),
                maxTemp:       parseFloat(d.maxtempC || 0),
                minTemp:       parseFloat(d.mintempC || 0),
                precipitation: parseFloat(d.hourly?.reduce((s, h) => s + parseFloat(h.precipMM || 0), 0) || 0),
                precipChance:  parseInt(d.hourly?.[4]?.chanceofrain || 0),
                wind:          parseFloat(d.hourly?.[4]?.windspeedKmph || 0),
                uvIndex:       parseInt(d.uvIndex || 0),
                sunrise:       d.astronomy?.[0]?.sunrise || '',
                sunset:        d.astronomy?.[0]?.sunset  || '',
                moonPhase:     d.astronomy?.[0]?.moon_phase || '',
                humidity:      parseInt(d.hourly?.[4]?.humidity || 0)
            })),
            alerts: []
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    // LOCATION NAME
    // ════════════════════════════════════════════════════════════════════════

    async getLocationName(lat, lon) {
        const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
        if (this.locationCache.has(key)) return this.locationCache.get(key);

        // Use WeatherAPI location name if available
        if (this.currentWeather?.location?.name) {
            this.locationCache.set(key, this.currentWeather.location.name);
            return this.currentWeather.location.name;
        }

        try {
            const controller = new AbortController();
            const timeout    = setTimeout(() => controller.abort(), 5000);
            const response   = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
                { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
            );
            clearTimeout(timeout);
            const data    = await response.json();
            const address = data.address || {};
            const parts   = [];
            const city    = address.city || address.town || address.village || address.county;
            if (city)                                    parts.push(city);
            if (address.state && address.state !== city) parts.push(address.state);
            if (address.country)                         parts.push(address.country);
            const name = parts.join(', ') || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
            this.locationCache.set(key, name);
            return name;
        } catch {
            return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // UNIT CONVERSION
    // ════════════════════════════════════════════════════════════════════════

    fmtTemp(c) {
        if (c == null || isNaN(c)) return '--';
        return this.unit === 'F' ? Math.round((c * 9/5) + 32) : Math.round(c);
    }

    fmtWind(kmh) {
        if (kmh == null || isNaN(kmh)) return '--';
        return this.unit === 'F' ? (kmh * 0.621371).toFixed(1) : kmh.toFixed(1);
    }

    windUnit() { return this.unit === 'F' ? 'mph' : 'km/h'; }

    // ════════════════════════════════════════════════════════════════════════
    // VIRTUAL GARDEN
    // ════════════════════════════════════════════════════════════════════════

    getGardenState(temp, humidity, windSpeed, precipitation, uvIndex) {
        let score   = 0;
        const facts = [];

        // Temperature (25 pts)
        if (temp >= 18 && temp <= 24) {
            score += 25; facts.push({ icon: '✅', text: `Temp ${Math.round(temp)}°C — perfect` });
        } else if (temp >= 10 && temp <= 32) {
            score += 16; facts.push({ icon: '🟡', text: `Temp ${Math.round(temp)}°C — acceptable` });
        } else if (temp >= 0 && temp <= 40) {
            score += 8;  facts.push({ icon: '⚠️', text: `Temp ${Math.round(temp)}°C — stressful` });
        } else {
            score += 2;  facts.push({ icon: '❌', text: `Temp ${Math.round(temp)}°C — extreme` });
        }

        // Humidity (25 pts)
        if (humidity >= 45 && humidity <= 65) {
            score += 25; facts.push({ icon: '✅', text: `Humidity ${humidity}% — ideal` });
        } else if (humidity >= 30 && humidity <= 80) {
            score += 16; facts.push({ icon: '🟡', text: `Humidity ${humidity}% — ok` });
        } else {
            score += 5;  facts.push({ icon: '⚠️', text: `Humidity ${humidity}% — poor` });
        }

        // Wind (20 pts)
        if (windSpeed < 10) {
            score += 20; facts.push({ icon: '✅', text: `Wind ${windSpeed.toFixed(0)} km/h — calm` });
        } else if (windSpeed < 25) {
            score += 13; facts.push({ icon: '🟡', text: `Wind ${windSpeed.toFixed(0)} km/h — breezy` });
        } else if (windSpeed < 50) {
            score += 5;  facts.push({ icon: '⚠️', text: `Wind ${windSpeed.toFixed(0)} km/h — strong` });
        } else {
            score += 1;  facts.push({ icon: '❌', text: `Wind ${windSpeed.toFixed(0)} km/h — damaging` });
        }

        // Precipitation (15 pts)
        if (precipitation === 0) {
            score += 15; facts.push({ icon: '✅', text: 'No rain — dry conditions' });
        } else if (precipitation < 2) {
            score += 12; facts.push({ icon: '✅', text: `Rain ${precipitation}mm — light, good` });
        } else if (precipitation < 10) {
            score += 7;  facts.push({ icon: '🟡', text: `Rain ${precipitation}mm — moderate` });
        } else {
            score += 2;  facts.push({ icon: '❌', text: `Rain ${precipitation}mm — heavy` });
        }

        // UV Index (15 pts)
        if (uvIndex <= 2) {
            score += 15; facts.push({ icon: '✅', text: `UV ${uvIndex} — low, safe` });
        } else if (uvIndex <= 5) {
            score += 12; facts.push({ icon: '✅', text: `UV ${uvIndex} — moderate` });
        } else if (uvIndex <= 8) {
            score += 7;  facts.push({ icon: '⚠️', text: `UV ${uvIndex} — high` });
        } else {
            score += 2;  facts.push({ icon: '❌', text: `UV ${uvIndex} — extreme` });
        }

        // Accumulate monthly score
        this.gardenScore  += score;
        this.gardenChecks += 1;
        localStorage.setItem('mini-weather-garden-score',  this.gardenScore);
        localStorage.setItem('mini-weather-garden-checks', this.gardenChecks);

        const avgScore = this.gardenChecks > 0 ? this.gardenScore / this.gardenChecks : score;

        let state, emoji, label;
        if (avgScore >= 88)      { state = 'thriving'; emoji = '🌻'; label = '🌻 THRIVING'; }
        else if (avgScore >= 68) { state = 'healthy';  emoji = '🌱'; label = '🌱 HEALTHY'; }
        else if (avgScore >= 45) { state = 'stressed'; emoji = '🌾'; label = '🌾 STRESSED'; }
        else                     { state = 'wilted';   emoji = '🍂'; label = '🍂 WILTED'; }

        return { state, emoji, label, score, avgScore: Math.round(avgScore), facts };
    }

    updateGarden(current) {
        const garden = this.getGardenState(
            current.temp        ?? 20,
            current.humidity    ?? 50,
            current.windSpeed   ?? 0,
            current.precipitation ?? 0,
            current.uvIndex     ?? 0
        );

        const container = document.getElementById('garden-container');
        const plant     = document.getElementById('garden-plant');
        const badge     = document.getElementById('garden-state-badge');
        const fill      = document.getElementById('garden-score-fill');
        const factors   = document.getElementById('garden-factors');

        if (!container) return;

        container.style.display = 'block';

        // Plant emoji + animation class
        plant.textContent = garden.emoji;
        plant.className   = `garden-plant ${garden.state}`;
        plant.setAttribute('aria-label', `Garden plant: ${garden.label}`);

        // State badge
        badge.textContent = garden.label;
        badge.className   = `garden-state-badge ${garden.state}`;

        // Score bar
        fill.style.width = `${garden.avgScore}%`;
        fill.className   = `garden-score-fill ${garden.state}`;

        // Factor cards
        factors.innerHTML = garden.facts.map(f =>
            `<div class="garden-factor">${f.icon} ${f.text}</div>`
        ).join('');

        // Meta
        const meta = document.getElementById('garden-meta');
        if (meta) meta.textContent = `Score: ${garden.avgScore}/100 this month`;

        this.checkGardenReset();
    }

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════

    async render() {
        if (!this.currentWeather) return;

        const { current, hourly, daily, source, alerts: apiAlerts } = this.currentWeather;
        const { latitude, longitude } = this.currentLocation;

        // Location name
        const locName = await this.getLocationName(latitude, longitude);
        this.locationName = locName;

        // Update location bar
        const locDisplay = document.getElementById('location-display');
        document.getElementById('loc-name').textContent    = `📍 ${locName}`;
        document.getElementById('loc-coords').textContent  = `${latitude.toFixed(3)}°N, ${longitude.toFixed(3)}°E`;
        document.getElementById('loc-time').textContent    = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        locDisplay.style.display = 'flex';

        // Build weather HTML
        const todaySunrise = daily?.[0]?.sunrise ? this._fmtTime(daily[0].sunrise) : null;
        const todaySunset  = daily?.[0]?.sunset  ? this._fmtTime(daily[0].sunset)  : null;
        const moonPhase    = daily?.[0]?.moonPhase || null;

        let html = `<div class="weather-card">`;

        // Main temp display
        html += `
            <div class="temp-display">
                <span class="weather-icon-main">${current.icon || '🌡️'}</span>
                <div class="temp-value">${this.fmtTemp(current.temp)}°${this.unit}</div>
                <div class="condition">${current.description}</div>
                <div class="feels-like">Feels like ${this.fmtTemp(current.feelsLike)}° &bull; ${current.isDay ? 'Daytime' : 'Nighttime'}</div>
            </div>
        `;

        // Sunrise/sunset bar
        if (todaySunrise || todaySunset) {
            html += `<div class="sun-bar">`;
            if (todaySunrise) html += `<div class="sun-item">🌅 Sunrise <strong>${todaySunrise}</strong></div>`;
            if (todaySunset)  html += `<div class="sun-item">🌇 Sunset <strong>${todaySunset}</strong></div>`;
            if (moonPhase)    html += `<div class="sun-item">🌙 ${moonPhase}</div>`;
            html += `</div>`;
        }

        // Stats grid
        html += `<div class="stats">`;
        const stats = [
            { label: '💧 Humidity',     value: `${current.humidity ?? '--'}%` },
            { label: '💨 Wind',         value: `${this.fmtWind(current.windSpeed)} ${this.windUnit()}` },
            { label: '💨 Gusts',        value: `${this.fmtWind(current.windGusts)} ${this.windUnit()}` },
            { label: '🧭 Wind Dir',     value: current.windDir || `${current.windDeg ?? '--'}°` },
            { label: '🔬 Pressure',     value: `${Math.round(current.pressure ?? 0)} hPa` },
            { label: '☀️ UV Index',     value: `${Math.round(current.uvIndex ?? 0)} — ${this._uvLabel(current.uvIndex)}` },
            { label: '👁️ Visibility',   value: `${(current.visibility ?? 0).toFixed(1)} km` },
            { label: '💧 Dew Point',    value: `${this.fmtTemp(current.dewPoint)}°` },
            { label: '☁️ Cloud Cover',  value: `${current.cloudCover ?? '--'}%` },
            { label: '🌧️ Precip',       value: `${(current.precipitation ?? 0).toFixed(1)} mm` },
        ];
        if (current.aqiIndex) {
            stats.push({ label: '🌬️ Air Quality', value: `${current.aqiLabel || current.aqiIndex}` });
        }
        stats.forEach(s => {
            html += `<div class="stat"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div>`;
        });
        html += `</div>`;

        // Source badge
        html += `<div class="source-badge">📡 ${source}</div>`;

        // Alerts (from API + computed)
        const alertsHtml = this._buildAlerts(current, daily, apiAlerts);
        if (alertsHtml) html += alertsHtml;

        // Hourly forecast
        if (hourly?.length > 0) {
            html += `<div class="section-title">⏰ Hourly Forecast</div><div class="hourly">`;
            hourly.slice(0, 24).forEach(h => {
                const time = this._fmtHour(h.time);
                html += `
                    <div class="hour">
                        <div class="hour-time">${time}</div>
                        <div class="hour-icon">${h.icon || this._wmoIcon(h.code, 1)}</div>
                        <div class="hour-temp">${this.fmtTemp(h.temp)}°</div>
                        <div class="hour-rain">💧${h.precipitation ?? 0}%</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        // Daily forecast
        if (daily?.length > 0) {
            html += `<div class="section-title">📅 14-Day Forecast</div><div class="daily">`;
            daily.slice(0, 14).forEach(d => {
                const dateStr = this._fmtDate(d.date);
                html += `
                    <div class="day">
                        <div class="day-date">${dateStr}</div>
                        <div class="day-icon">${d.icon || this._wmoIcon(d.code, 1)}</div>
                        <div class="day-temps">
                            <span class="day-max">${this.fmtTemp(d.maxTemp)}°</span>
                            <span class="day-min">${this.fmtTemp(d.minTemp)}°</span>
                        </div>
                        <div class="day-rain">💧${d.precipChance ?? 0}%</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div>`; // close weather-card

        document.getElementById('weather-content').innerHTML = html;

        // Update garden
        this.updateGarden(current);

        // Check and send weather alerts
        this.checkWeatherAlerts(current, daily);
    }

    _buildAlerts(current, daily, apiAlerts) {
        const items = [];

        // API-provided alerts
        if (apiAlerts?.length > 0) {
            apiAlerts.slice(0, 3).forEach(a => {
                const cls = a.severity?.toLowerCase().includes('extreme') || a.severity?.toLowerCase().includes('severe') ? 'alert-danger' : 'alert-warning';
                items.push(`<div class="alert ${cls}">⚠️ <strong>${a.headline || 'Weather Alert'}</strong></div>`);
            });
        }

        // Computed alerts
        if ((current.uvIndex ?? 0) >= 11) {
            items.push(`<div class="alert alert-danger">☀️ <strong>EXTREME UV ${Math.round(current.uvIndex)}</strong> — Avoid direct sun exposure</div>`);
        } else if ((current.uvIndex ?? 0) >= 8) {
            items.push(`<div class="alert alert-warning">☀️ Very High UV ${Math.round(current.uvIndex)} — Use SPF 50+ sunscreen</div>`);
        } else if ((current.uvIndex ?? 0) >= 6) {
            items.push(`<div class="alert alert-info">☀️ High UV ${Math.round(current.uvIndex)} — Sunscreen recommended</div>`);
        }

        if ((current.windSpeed ?? 0) > 60) {
            items.push(`<div class="alert alert-danger">💨 <strong>SEVERE WINDS</strong> ${this.fmtWind(current.windSpeed)} ${this.windUnit()} — Dangerous conditions</div>`);
        } else if ((current.windSpeed ?? 0) > 40) {
            items.push(`<div class="alert alert-warning">💨 Strong winds ${this.fmtWind(current.windSpeed)} ${this.windUnit()} — Exercise caution</div>`);
        }

        if (daily?.[0]?.precipChance > 85) {
            items.push(`<div class="alert alert-warning">⛈️ Heavy rain expected today — ${daily[0].precipChance}% chance</div>`);
        } else if (daily?.[0]?.precipChance > 60) {
            items.push(`<div class="alert alert-info">🌧️ Rain likely today — ${daily[0].precipChance}% chance</div>`);
        }

        if ((current.temp ?? 20) >= 40) {
            items.push(`<div class="alert alert-danger">🌡️ <strong>EXTREME HEAT</strong> ${this.fmtTemp(current.temp)}° — Heat stroke risk</div>`);
        } else if ((current.temp ?? 20) <= -10) {
            items.push(`<div class="alert alert-danger">❄️ <strong>EXTREME COLD</strong> ${this.fmtTemp(current.temp)}° — Frostbite risk</div>`);
        } else if ((current.temp ?? 20) <= 0) {
            items.push(`<div class="alert alert-warning">❄️ Freezing ${this.fmtTemp(current.temp)}° — Watch for ice</div>`);
        }

        if (current.aqiIndex && current.aqiIndex >= 4) {
            items.push(`<div class="alert alert-warning">🌬️ Air quality: <strong>${current.aqiLabel}</strong> — Limit outdoor activity</div>`);
        }

        if (items.length === 0) return '';
        return `<div class="alerts">${items.join('')}</div>`;
    }

    _uvLabel(uv) {
        if (uv == null) return '';
        if (uv <= 2)  return 'Low';
        if (uv <= 5)  return 'Moderate';
        if (uv <= 7)  return 'High';
        if (uv <= 10) return 'Very High';
        return 'Extreme';
    }

    _fmtTime(str) {
        if (!str) return '';
        try {
            // WeatherAPI returns "06:30 AM", Open-Meteo returns ISO datetime
            if (str.includes('AM') || str.includes('PM')) return str;
            const d = new Date(str);
            if (isNaN(d)) return str;
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch { return str; }
    }

    _fmtHour(str) {
        if (!str) return '--';
        try {
            const d = new Date(str);
            if (isNaN(d)) return str.slice(11, 16) || str;
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch { return '--'; }
    }

    _fmtDate(str) {
        if (!str) return '--';
        try {
            const d = new Date(str + 'T12:00:00');
            if (isNaN(d)) return str;
            return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        } catch { return str; }
    }

    // ════════════════════════════════════════════════════════════════════════
    // UI HELPERS
    // ════════════════════════════════════════════════════════════════════════

    showLoading(msg = 'Fetching weather data...') {
        document.getElementById('weather-content').innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p class="loading-text">${msg}</p>
            </div>
        `;
    }

    showError(message) {
        document.getElementById('weather-content').innerHTML = `
            <div class="error">
                <div class="error-title">⚠️ Something went wrong</div>
                <div class="error-msg">${message}</div>
                <button class="btn-primary" onclick="app.requestLocation()" style="margin: 0 auto;">
                    📍 Try Again
                </button>
            </div>
        `;
    }

    toggleUnit() {
        this.unit = this.unit === 'C' ? 'F' : 'C';
        localStorage.setItem('mini-weather-unit', this.unit);
        document.getElementById('unit-btn').textContent = `°${this.unit}`;
        // Invalidate cache to force re-render with new unit
        if (this.currentWeather) this.render();
    }

    refresh() {
        if (!this.currentLocation) { this._toast('Click 📍 to get your location first'); return; }
        // Clear cache for current location
        const key = this._cacheKey();
        this.cache.delete(key);
        this.fetchWeather();
    }

    // ════════════════════════════════════════════════════════════════════════
    // API MODAL
    // ════════════════════════════════════════════════════════════════════════

    showAPIModal() {
        const list = document.getElementById('api-list');
        list.innerHTML = '';

        Object.entries(this.apis).forEach(([key, api]) => {
            const div = document.createElement('div');
            div.className = 'api-option' + (key === this.apiSource ? ' selected' : '');
            div.innerHTML = `
                <div class="api-name">
                    ${api.name}
                    ${api.badge ? `<span class="api-badge">${api.badge}</span>` : ''}
                    ${key === this.apiSource ? '<span class="api-badge" style="background:rgba(30,136,229,0.2);color:#90caf9;border-color:rgba(30,136,229,0.4);">ACTIVE</span>' : ''}
                </div>
                <div class="api-desc">${api.desc}</div>
            `;
            div.addEventListener('click', () => {
                this.apiSource = key;
                localStorage.setItem('mini-weather-api', key);
                this.closeAPIModal();
                if (this.currentLocation) {
                    this.cache.clear(); // clear cache when switching API
                    this.fetchWeather();
                }
            });
            list.appendChild(div);
        });

        document.getElementById('api-modal').classList.add('active');
    }

    closeAPIModal() {
        document.getElementById('api-modal').classList.remove('active');
    }

    // ════════════════════════════════════════════════════════════════════════
    // THEME MODAL
    // ════════════════════════════════════════════════════════════════════════

    showThemeModal() {
        this._renderThemeList('');
        document.getElementById('theme-modal').classList.add('active');
        document.getElementById('theme-search').value = '';
        document.getElementById('theme-search').focus();
    }

    closeThemeModal() {
        document.getElementById('theme-modal').classList.remove('active');
    }

    filterThemes(query) {
        this._renderThemeList(query.toLowerCase().trim());
    }

    _renderThemeList(query) {
        const list = document.getElementById('theme-list');
        list.innerHTML = '';

        // Group by category
        const categories = {};
        Object.entries(this.themes).forEach(([key, theme]) => {
            if (query && !theme.name.toLowerCase().includes(query) && !theme.cat.toLowerCase().includes(query)) return;
            if (!categories[theme.cat]) categories[theme.cat] = [];
            categories[theme.cat].push({ key, theme });
        });

        if (Object.keys(categories).length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">No themes found</div>';
            return;
        }

        Object.entries(categories).forEach(([cat, items]) => {
            const catEl = document.createElement('div');
            catEl.className = 'theme-category';
            catEl.textContent = cat;
            list.appendChild(catEl);

            const grid = document.createElement('div');
            grid.className = 'theme-grid';

            items.forEach(({ key, theme }) => {
                const div = document.createElement('div');
                div.className = 'theme-option' + (key === this.theme ? ' selected' : '');
                div.innerHTML = `
                    <div class="theme-swatch" style="background:${theme.accent};"></div>
                    <span class="theme-name">${theme.name}</span>
                `;
                div.addEventListener('click', () => {
                    this.applyTheme(key);
                    // Update selected state
                    list.querySelectorAll('.theme-option').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                });
                grid.appendChild(div);
            });

            list.appendChild(grid);
        });
    }
}

// ════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ════════════════════════════════════════════════════════════════════════════

const app = new WeatherApp();

// Restore saved location on load
(function restoreLocation() {
    try {
        const saved = localStorage.getItem('mini-weather-location');
        if (saved) {
            const loc = JSON.parse(saved);
            if (loc?.latitude && loc?.longitude) {
                app.currentLocation = loc;
                app.fetchWeather();
                app.startAutoUpdate();
            }
        }
    } catch (err) {
        console.warn('Could not restore saved location:', err);
        localStorage.removeItem('mini-weather-location');
    }
})();
