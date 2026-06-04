// Mini Weather - Privacy-First, Multi-API Weather App
// Features: Location access button, multiple weather APIs, fast & accurate

class WeatherApp {
    constructor() {
        this.currentLocation = null;
        this.currentWeather = null;
        this.unit = localStorage.getItem('mini-weather-unit') || 'C';
        this.apiSource = localStorage.getItem('mini-weather-api') || 'open-meteo';
        this.cache = new Map();
        this.cacheTime = 10 * 60 * 1000; // 10 minutes

        this.apis = {
            'open-meteo': {
                name: 'Open-Meteo',
                desc: 'Free, accurate, no API key needed',
                fetch: (lat, lon) => this.fetchOpenMeteo(lat, lon)
            },
            'nws': {
                name: 'National Weather Service',
                desc: 'US only, highly accurate',
                fetch: (lat, lon) => this.fetchNWS(lat, lon)
            },
            'wttr': {
                name: 'wttr.in',
                desc: 'Fast, simple, global coverage',
                fetch: (lat, lon) => this.fetchWttr(lat, lon)
            }
        };

        this.initEventListeners();
        this.registerServiceWorker();
    }

    initEventListeners() {
        document.getElementById('location-btn').addEventListener('click', () => this.requestLocation());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
        document.getElementById('unit-btn').addEventListener('click', () => this.toggleUnit());
        document.getElementById('api-btn').addEventListener('click', () => this.showAPIModal());

        document.getElementById('api-modal').addEventListener('click', (e) => {
            if (e.target.id === 'api-modal') this.closeAPIModal();
        });
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    async requestLocation() {
        const btn = document.getElementById('location-btn');
        btn.disabled = true;
        btn.textContent = '⏳';

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 300000
                });
            });

            const { latitude, longitude } = position.coords;
            this.currentLocation = { latitude, longitude };
            localStorage.setItem('mini-weather-location', JSON.stringify(this.currentLocation));

            await this.fetchWeather();
        } catch (error) {
            this.showError('Location access denied. Please enable location permissions.');
            console.error('Location error:', error);
        } finally {
            btn.disabled = false;
            btn.textContent = '📍';
        }
    }

    async fetchWeather() {
        if (!this.currentLocation) {
            this.showError('No location selected');
            return;
        }

        const { latitude, longitude } = this.currentLocation;
        const cacheKey = `${latitude.toFixed(3)}-${longitude.toFixed(3)}-${this.apiSource}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < this.cacheTime) {
                this.currentWeather = cached.data;
                this.render();
                return;
            }
        }

        this.showLoading();

        try {
            const api = this.apis[this.apiSource];
            const weather = await api.fetch(latitude, longitude);
            this.currentWeather = weather;
            this.cache.set(cacheKey, { data: weather, time: Date.now() });
            this.render();
        } catch (error) {
            this.showError(`Failed to fetch weather: ${error.message}`);
            console.error('Weather fetch error:', error);
        }
    }

    async fetchOpenMeteo(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat.toFixed(3),
            longitude: lon.toFixed(3),
            current: 'temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,apparent_temperature,pressure_msl,visibility,uv_index,precipitation,cloud_cover',
            hourly: 'temperature_2m,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
            timezone: 'auto',
            forecast_days: 14
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return this.normalizeOpenMeteo(data);
    }

    normalizeOpenMeteo(data) {
        const current = data.current;
        const hourly = data.hourly;
        const daily = data.daily;

        return {
            source: 'Open-Meteo',
            location: {
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone
            },
            current: {
                temp: current.temperature_2m,
                code: current.weather_code,
                description: this.getDescription(current.weather_code),
                icon: this.getIcon(current.weather_code),
                humidity: current.relative_humidity_2m,
                windSpeed: current.wind_speed_10m,
                windGusts: current.wind_gusts_10m,
                feelsLike: current.apparent_temperature,
                pressure: current.pressure_msl,
                visibility: current.visibility / 1000,
                uvIndex: current.uv_index,
                cloudCover: current.cloud_cover,
                precipitation: current.precipitation || 0
            },
            hourly: hourly.time.slice(0, 48).map((time, i) => ({
                time,
                temp: hourly.temperature_2m[i],
                code: hourly.weather_code[i],
                precipitation: hourly.precipitation_probability[i] || 0,
                wind: hourly.wind_speed_10m[i],
                humidity: hourly.relative_humidity_2m[i]
            })),
            daily: daily.time.map((date, i) => ({
                date,
                code: daily.weather_code[i],
                maxTemp: daily.temperature_2m_max[i],
                minTemp: daily.temperature_2m_min[i],
                precipitation: daily.precipitation_sum[i] || 0,
                precipChance: daily.precipitation_probability_max[i] || 0,
                wind: daily.wind_speed_10m_max[i],
                uvIndex: daily.uv_index_max[i],
                sunrise: daily.sunrise[i],
                sunset: daily.sunset[i]
            }))
        };
    }

    async fetchNWS(lat, lon) {
        // National Weather Service (US only)
        const gridResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
            signal: AbortSignal.timeout(8000)
        });

        if (!gridResponse.ok) throw new Error('NWS: Location not in US');

        const gridData = await gridResponse.json();
        const forecastUrl = gridData.properties.forecast;
        const forecastResponse = await fetch(forecastUrl, {
            signal: AbortSignal.timeout(8000)
        });

        if (!forecastResponse.ok) throw new Error('NWS: Forecast unavailable');

        const forecastData = await forecastResponse.json();
        return this.normalizeNWS(forecastData);
    }

    normalizeNWS(data) {
        const periods = data.properties.periods;
        const current = periods[0];

        return {
            source: 'National Weather Service',
            location: {
                latitude: data.geometry.coordinates[1],
                longitude: data.geometry.coordinates[0],
                timezone: 'US'
            },
            current: {
                temp: current.temperature,
                code: 0,
                description: current.shortForecast,
                icon: this.getIcon(0),
                humidity: 50,
                windSpeed: parseInt(current.windSpeed) || 0,
                windGusts: 0,
                feelsLike: current.temperature,
                pressure: 1013,
                visibility: 10,
                uvIndex: 5,
                cloudCover: 50,
                precipitation: 0
            },
            hourly: [],
            daily: periods.filter((_, i) => i % 2 === 0).slice(0, 7).map(p => ({
                date: p.startTime.split('T')[0],
                code: 0,
                maxTemp: p.temperature,
                minTemp: p.temperature - 5,
                precipitation: 0,
                precipChance: 0,
                wind: parseInt(p.windSpeed) || 0,
                uvIndex: 5,
                sunrise: '06:00',
                sunset: '18:00'
            }))
        };
    }

    async fetchWttr(lat, lon) {
        const response = await fetch(`https://wttr.in/${lat},${lon}?format=j1`, {
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) throw new Error('wttr.in unavailable');

        const data = await response.json();
        return this.normalizeWttr(data);
    }

    normalizeWttr(data) {
        const current = data.current_condition[0];
        const forecast = data.weather[0];

        return {
            source: 'wttr.in',
            location: {
                latitude: data.nearest_area[0].latitude,
                longitude: data.nearest_area[0].longitude,
                timezone: 'UTC'
            },
            current: {
                temp: current.temp_C,
                code: 0,
                description: current.weatherDesc[0].value,
                icon: this.getIcon(0),
                humidity: current.humidity,
                windSpeed: current.windspeedKmph,
                windGusts: current.WindGustKmph,
                feelsLike: current.FeelsLikeC,
                pressure: current.pressure,
                visibility: current.visibility,
                uvIndex: current.uvIndex,
                cloudCover: current.cloudcover,
                precipitation: current.precipMM || 0
            },
            hourly: [],
            daily: forecast.hourly.slice(0, 7).map((h, i) => ({
                date: forecast.date,
                code: 0,
                maxTemp: h.tempC,
                minTemp: h.tempC - 3,
                precipitation: h.precipMM || 0,
                precipChance: h.chanceofrain || 0,
                wind: h.windspeedKmph,
                uvIndex: h.uvIndex,
                sunrise: '06:00',
                sunset: '18:00'
            }))
        };
    }

    getDescription(code) {
        const map = {
            0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
            45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
            55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
            71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
            80: 'Rain showers', 81: 'Heavy showers', 82: 'Violent showers',
            85: 'Snow showers', 86: 'Heavy snow showers',
            95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm'
        };
        return map[code] || 'Unknown';
    }

    getIcon(code) {
        if (code === 0) return '☀️';
        if (code === 1 || code === 2) return '⛅';
        if (code === 3) return '☁️';
        if (code === 45 || code === 48) return '🌫️';
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
        if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
        if ([95, 96, 99].includes(code)) return '⛈️';
        return '🌡️';
    }

    async getLocationName(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
                { signal: AbortSignal.timeout(5000) }
            );
            const data = await response.json();
            const address = data.address || {};
            const parts = [];
            if (address.city) parts.push(address.city);
            else if (address.town) parts.push(address.town);
            if (address.state && address.state !== address.city) parts.push(address.state);
            if (address.country) parts.push(address.country);
            return parts.join(', ') || 'Unknown Location';
        } catch {
            return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
        }
    }

    formatTemp(temp) {
        if (this.unit === 'F') {
            return Math.round((temp * 9/5) + 32);
        }
        return Math.round(temp);
    }

    formatWind(speed) {
        if (this.unit === 'F') {
            return Math.round(speed * 0.621371 * 10) / 10;
        }
        return Math.round(speed * 10) / 10;
    }

    getWindUnit() {
        return this.unit === 'F' ? 'mph' : 'km/h';
    }

    async render() {
        if (!this.currentWeather) return;

        const { current, hourly, daily, source } = this.currentWeather;
        const { latitude, longitude } = this.currentLocation;
        const locationName = await this.getLocationName(latitude, longitude);

        // Update location display
        const locDisplay = document.getElementById('location-display');
        document.getElementById('loc-name').textContent = `📍 ${locationName}`;
        document.getElementById('loc-coords').textContent = `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`;
        document.getElementById('loc-time').textContent = new Date().toLocaleTimeString();
        locDisplay.style.display = 'flex';

        // Build weather HTML
        let html = `
            <div class="weather-card">
                <div class="temp-display">
                    <div class="temp-value">${this.formatTemp(current.temp)}°${this.unit}</div>
                    <div class="condition">${current.description}</div>
                    <div class="feels-like">Feels like ${this.formatTemp(current.feelsLike)}°</div>
                </div>

                <div class="stats">
                    <div class="stat">
                        <div class="stat-label">💧 Humidity</div>
                        <div class="stat-value">${current.humidity}%</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">💨 Wind</div>
                        <div class="stat-value">${this.formatWind(current.windSpeed)} ${this.getWindUnit()}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">🔬 Pressure</div>
                        <div class="stat-value">${Math.round(current.pressure)} hPa</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">☀️ UV</div>
                        <div class="stat-value">${Math.round(current.uvIndex)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">👁️ Visibility</div>
                        <div class="stat-value">${current.visibility.toFixed(1)} km</div>
                    </div>
                </div>

                <div class="source-badge">📡 ${source}</div>
        `;

        // Alerts
        if (current.uvIndex > 8) {
            html += '<div class="alerts"><div class="alert alert-danger">☀️ EXTREME UV: ${Math.round(current.uvIndex)}</div></div>';
        } else if (current.uvIndex > 6) {
            html += '<div class="alerts"><div class="alert alert-warning">☀️ High UV: ${Math.round(current.uvIndex)}</div></div>';
        }

        if (current.windSpeed > 40) {
            html += '<div class="alert alert-warning">💨 Strong winds: ${Math.round(current.windSpeed)} ${this.getWindUnit()}</div>';
        }

        // Hourly forecast
        if (hourly.length > 0) {
            html += '<div class="section-title">Hourly</div><div class="hourly">';
            hourly.slice(0, 24).forEach(h => {
                const time = new Date(h.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                html += `
                    <div class="hour">
                        <div class="hour-time">${time}</div>
                        <div class="hour-icon">${this.getIcon(h.code)}</div>
                        <div class="hour-temp">${this.formatTemp(h.temp)}°</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Daily forecast
        if (daily.length > 0) {
            html += '<div class="section-title">Forecast</div><div class="daily">';
            daily.slice(0, 7).forEach(d => {
                const date = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                html += `
                    <div class="day">
                        <div class="day-date">${date}</div>
                        <div class="day-icon">${this.getIcon(d.code)}</div>
                        <div class="day-temps">
                            <span class="day-max">${this.formatTemp(d.maxTemp)}°</span>
                            <span class="day-min">${this.formatTemp(d.minTemp)}°</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += '</div>';
        document.getElementById('weather-content').innerHTML = html;
    }

    showLoading() {
        document.getElementById('weather-content').innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p style="color: var(--text-dim);">Fetching weather...</p>
            </div>
        `;
    }

    showError(message) {
        document.getElementById('weather-content').innerHTML = `<div class="error">${message}</div>`;
    }

    toggleUnit() {
        this.unit = this.unit === 'C' ? 'F' : 'C';
        localStorage.setItem('mini-weather-unit', this.unit);
        document.getElementById('unit-btn').textContent = `°${this.unit}`;
        if (this.currentWeather) this.render();
    }

    refresh() {
        if (this.currentLocation) this.fetchWeather();
    }

    showAPIModal() {
        const modal = document.getElementById('api-modal');
        const list = document.getElementById('api-list');
        list.innerHTML = '';

        Object.entries(this.apis).forEach(([key, api]) => {
            const div = document.createElement('div');
            div.className = 'api-option' + (key === this.apiSource ? ' selected' : '');
            div.innerHTML = `
                <div class="api-name">${api.name}</div>
                <div class="api-desc">${api.desc}</div>
            `;
            div.addEventListener('click', () => {
                this.apiSource = key;
                localStorage.setItem('mini-weather-api', key);
                this.closeAPIModal();
                if (this.currentLocation) this.fetchWeather();
            });
            list.appendChild(div);
        });

        modal.classList.add('active');
    }

    closeAPIModal() {
        document.getElementById('api-modal').classList.remove('active');
    }
}

// Initialize app
const app = new WeatherApp();

// Try to restore location from storage
const savedLocation = localStorage.getItem('mini-weather-location');
if (savedLocation) {
    app.currentLocation = JSON.parse(savedLocation);
    app.fetchWeather();
}

