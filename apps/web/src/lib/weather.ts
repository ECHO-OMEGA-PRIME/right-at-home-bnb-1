/**
 * Weather Service for Right at Home BnB
 * Fetches weather data for Midland, TX (79705)
 *
 * Uses OpenWeatherMap API (free tier: 1000 calls/day)
 * Caches results for 30 minutes to reduce API calls
 */

// ============ Types ============

export interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

export interface CurrentWeather {
  location: string;
  zipCode: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  conditions: WeatherCondition[];
  visibility: number;
  pressure: number;
  sunrise: string;
  sunset: string;
  updatedAt: string;
}

export interface WeatherForecastDay {
  date: string;
  dayName: string;
  high: number;
  low: number;
  conditions: WeatherCondition[];
  precipitation: number;
  humidity: number;
  windSpeed: number;
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: WeatherForecastDay[];
  alerts: WeatherAlert[];
  summary: string;
}

export interface WeatherAlert {
  event: string;
  headline: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  start: string;
  end: string;
  description: string;
}

// ============ Configuration ============

const MIDLAND_TX = {
  zip: '79705',
  city: 'Midland',
  state: 'TX',
  lat: 31.9973,
  lon: -102.0779,
  country: 'US'
};

// Cache weather data for 30 minutes
let weatherCache: { data: WeatherData | null; timestamp: number } = {
  data: null,
  timestamp: 0
};
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ============ Helper Functions ============

/**
 * Convert wind degrees to cardinal direction
 */
function degreesToCardinal(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Convert Kelvin to Fahrenheit
 */
function kelvinToFahrenheit(kelvin: number): number {
  return Math.round((kelvin - 273.15) * 9/5 + 32);
}

/**
 * Convert m/s to mph
 */
function msToMph(ms: number): number {
  return Math.round(ms * 2.237);
}

/**
 * Format Unix timestamp to ISO string
 */
function unixToISO(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

/**
 * Get day name from date
 */
function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Generate weather summary for voice/AI
 */
function generateWeatherSummary(data: Omit<WeatherData, 'summary'>): string {
  const { current, forecast, alerts } = data;
  const lines: string[] = [];

  // Current conditions
  const conditionText = current.conditions.map(c => c.description).join(', ');
  lines.push(
    `Currently ${current.temperature}°F and ${conditionText} in ${current.location}. ` +
    `Feels like ${current.feelsLike}°F with ${current.humidity}% humidity.`
  );

  // Wind
  if (current.windSpeed > 15) {
    lines.push(`Winds are ${current.windSpeed} mph from the ${current.windDirection}.`);
  }

  // Today's forecast
  if (forecast.length > 0) {
    const today = forecast[0];
    lines.push(`Today's high ${today.high}°F, low ${today.low}°F.`);
  }

  // Alerts
  if (alerts.length > 0) {
    const severeAlerts = alerts.filter(a => a.severity === 'severe' || a.severity === 'extreme');
    if (severeAlerts.length > 0) {
      lines.push(`WEATHER ALERT: ${severeAlerts.map(a => a.headline).join('. ')}`);
    }
  }

  // Tomorrow
  if (forecast.length > 1) {
    const tomorrow = forecast[1];
    lines.push(`Tomorrow: ${tomorrow.conditions[0]?.description || 'unknown'}, high ${tomorrow.high}°F.`);
  }

  return lines.join(' ');
}

// ============ API Functions ============

/**
 * Fetch current weather from OpenWeatherMap
 */
async function fetchCurrentWeather(apiKey: string): Promise<CurrentWeather | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?zip=${MIDLAND_TX.zip},${MIDLAND_TX.country}&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[Weather] API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    return {
      location: `${MIDLAND_TX.city}, ${MIDLAND_TX.state}`,
      zipCode: MIDLAND_TX.zip,
      temperature: kelvinToFahrenheit(data.main.temp),
      feelsLike: kelvinToFahrenheit(data.main.feels_like),
      humidity: data.main.humidity,
      windSpeed: msToMph(data.wind.speed),
      windDirection: degreesToCardinal(data.wind.deg || 0),
      conditions: data.weather.map((w: any) => ({
        id: w.id,
        main: w.main,
        description: w.description,
        icon: w.icon
      })),
      visibility: Math.round((data.visibility || 10000) / 1609), // meters to miles
      pressure: data.main.pressure,
      sunrise: unixToISO(data.sys.sunrise),
      sunset: unixToISO(data.sys.sunset),
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Weather] Error fetching current weather:', error);
    return null;
  }
}

/**
 * Fetch 5-day forecast from OpenWeatherMap
 */
async function fetchForecast(apiKey: string): Promise<WeatherForecastDay[]> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?zip=${MIDLAND_TX.zip},${MIDLAND_TX.country}&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[Weather] Forecast API error:', response.status);
      return [];
    }

    const data = await response.json();

    // Group by day and find high/low
    const dailyData: Map<string, {
      temps: number[];
      conditions: any[];
      humidity: number[];
      wind: number[];
      rain: number;
    }> = new Map();

    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];

      if (!dailyData.has(date)) {
        dailyData.set(date, {
          temps: [],
          conditions: [],
          humidity: [],
          wind: [],
          rain: 0
        });
      }

      const day = dailyData.get(date)!;
      day.temps.push(kelvinToFahrenheit(item.main.temp));
      day.conditions.push(item.weather[0]);
      day.humidity.push(item.main.humidity);
      day.wind.push(msToMph(item.wind.speed));
      day.rain += item.rain?.['3h'] || 0;
    }

    // Convert to forecast days
    const forecast: WeatherForecastDay[] = [];

    for (const [date, day] of Array.from(dailyData.entries())) {
      if (forecast.length >= 5) break;

      // Use noon conditions as representative
      const noonIndex = Math.floor(day.conditions.length / 2);

      forecast.push({
        date,
        dayName: getDayName(date),
        high: Math.max(...day.temps),
        low: Math.min(...day.temps),
        conditions: [{
          id: day.conditions[noonIndex].id,
          main: day.conditions[noonIndex].main,
          description: day.conditions[noonIndex].description,
          icon: day.conditions[noonIndex].icon
        }],
        precipitation: Math.round(day.rain * 100) / 100,
        humidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
        windSpeed: Math.round(day.wind.reduce((a, b) => a + b, 0) / day.wind.length)
      });
    }

    return forecast;
  } catch (error) {
    console.error('[Weather] Error fetching forecast:', error);
    return [];
  }
}

/**
 * Fetch weather alerts from OpenWeatherMap One Call API
 * Note: Requires paid plan, returns empty if not available
 */
async function fetchAlerts(apiKey: string): Promise<WeatherAlert[]> {
  try {
    // One Call API 3.0 for alerts (may require subscription)
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${MIDLAND_TX.lat}&lon=${MIDLAND_TX.lon}&exclude=minutely,hourly,daily&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      // Not available on free tier, return empty
      return [];
    }

    const data = await response.json();

    if (!data.alerts || data.alerts.length === 0) {
      return [];
    }

    return data.alerts.map((alert: any) => ({
      event: alert.event,
      headline: alert.event,
      severity: getSeverity(alert.tags),
      start: unixToISO(alert.start),
      end: unixToISO(alert.end),
      description: alert.description
    }));
  } catch (error) {
    // Alerts not available, not an error
    return [];
  }
}

function getSeverity(tags: string[]): 'minor' | 'moderate' | 'severe' | 'extreme' {
  if (!tags) return 'moderate';
  if (tags.includes('Extreme')) return 'extreme';
  if (tags.includes('Severe')) return 'severe';
  if (tags.includes('Moderate')) return 'moderate';
  return 'minor';
}

// ============ Main Export Functions ============

/**
 * Get weather data for Midland, TX (79705)
 * Caches results for 30 minutes
 */
export async function getWeather(): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    console.warn('[Weather] OPENWEATHER_API_KEY not configured');
    return getMockWeather();
  }

  // Check cache
  const now = Date.now();
  if (weatherCache.data && (now - weatherCache.timestamp) < CACHE_DURATION_MS) {
    console.log('[Weather] Returning cached data');
    return weatherCache.data;
  }

  console.log('[Weather] Fetching fresh weather data for', MIDLAND_TX.city);

  // Fetch all data in parallel
  const [current, forecast, alerts] = await Promise.all([
    fetchCurrentWeather(apiKey),
    fetchForecast(apiKey),
    fetchAlerts(apiKey)
  ]);

  if (!current) {
    console.error('[Weather] Failed to fetch current weather');
    return weatherCache.data || getMockWeather();
  }

  const dataWithoutSummary = { current, forecast, alerts };
  const summary = generateWeatherSummary(dataWithoutSummary);

  const weatherData: WeatherData = {
    ...dataWithoutSummary,
    summary
  };

  // Update cache
  weatherCache = {
    data: weatherData,
    timestamp: now
  };

  return weatherData;
}

/**
 * Get just the current conditions
 */
export async function getCurrentWeather(): Promise<CurrentWeather | null> {
  const data = await getWeather();
  return data?.current || null;
}

/**
 * Get weather summary for voice/AI
 */
export async function getWeatherSummary(): Promise<string> {
  const data = await getWeather();
  return data?.summary || 'Weather data unavailable.';
}

/**
 * Get mock weather data when API key not configured
 * Uses realistic Midland, TX weather patterns
 */
function getMockWeather(): WeatherData {
  const now = new Date();
  const month = now.getMonth();

  // Midland TX typical weather by season
  let baseTemp: number;
  let conditions: string;

  if (month >= 5 && month <= 8) {
    // Summer: Hot and dry
    baseTemp = 95 + Math.floor(Math.random() * 10);
    conditions = 'clear sky';
  } else if (month >= 11 || month <= 2) {
    // Winter: Cool and dry
    baseTemp = 50 + Math.floor(Math.random() * 15);
    conditions = 'few clouds';
  } else {
    // Spring/Fall: Variable
    baseTemp = 70 + Math.floor(Math.random() * 15);
    conditions = 'scattered clouds';
  }

  const current: CurrentWeather = {
    location: `${MIDLAND_TX.city}, ${MIDLAND_TX.state}`,
    zipCode: MIDLAND_TX.zip,
    temperature: baseTemp,
    feelsLike: baseTemp + 3,
    humidity: 25 + Math.floor(Math.random() * 20),
    windSpeed: 10 + Math.floor(Math.random() * 15),
    windDirection: ['N', 'S', 'SW', 'NW'][Math.floor(Math.random() * 4)],
    conditions: [{
      id: 800,
      main: 'Clear',
      description: conditions,
      icon: '01d'
    }],
    visibility: 10,
    pressure: 1015,
    sunrise: new Date(now.setHours(6, 30, 0)).toISOString(),
    sunset: new Date(now.setHours(19, 30, 0)).toISOString(),
    updatedAt: new Date().toISOString()
  };

  const forecast: WeatherForecastDay[] = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    forecast.push({
      date: date.toISOString().split('T')[0],
      dayName: getDayName(date.toISOString()),
      high: baseTemp + Math.floor(Math.random() * 5),
      low: baseTemp - 15 - Math.floor(Math.random() * 10),
      conditions: current.conditions,
      precipitation: 0,
      humidity: current.humidity,
      windSpeed: current.windSpeed
    });
  }

  const dataWithoutSummary = { current, forecast, alerts: [] };

  return {
    ...dataWithoutSummary,
    summary: generateWeatherSummary(dataWithoutSummary) + ' (Mock data - API key not configured)'
  };
}

/**
 * Check if weather affects property operations
 * Returns warnings for extreme conditions
 */
export function checkWeatherImpact(weather: WeatherData): string[] {
  const warnings: string[] = [];
  const { current, alerts } = weather;

  // Temperature warnings
  if (current.temperature >= 105) {
    warnings.push('EXTREME HEAT WARNING: Consider rescheduling outdoor work');
  } else if (current.temperature >= 95) {
    warnings.push('Heat advisory: Ensure cleaners have water, AC working at properties');
  } else if (current.temperature <= 32) {
    warnings.push('FREEZE WARNING: Check pipes, leave faucets dripping at vacant properties');
  }

  // Wind warnings
  if (current.windSpeed >= 40) {
    warnings.push('HIGH WIND WARNING: Secure outdoor furniture at properties');
  } else if (current.windSpeed >= 25) {
    warnings.push('Wind advisory: May affect pool cleaning, outdoor tasks');
  }

  // Visibility (dust storms common in Midland)
  if (current.visibility <= 3) {
    warnings.push('LOW VISIBILITY: Possible dust storm, may affect travel');
  }

  // Weather alerts
  for (const alert of alerts) {
    if (alert.severity === 'severe' || alert.severity === 'extreme') {
      warnings.push(`${alert.severity.toUpperCase()}: ${alert.headline}`);
    }
  }

  return warnings;
}

export default {
  getWeather,
  getCurrentWeather,
  getWeatherSummary,
  checkWeatherImpact
};
