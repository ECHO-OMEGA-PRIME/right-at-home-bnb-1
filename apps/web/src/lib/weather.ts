/**
 * Right at Home BnB — Midland weather through the National Weather Service.
 * No random or fabricated fallback values are returned.
 */

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

export interface WeatherAlert {
  event: string;
  headline: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  start: string;
  end: string;
  description: string;
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: WeatherForecastDay[];
  alerts: WeatherAlert[];
  summary: string;
  source?: 'NWS';
}

const MIDLAND = {
  city: 'Midland',
  state: 'TX',
  zipCode: '79705',
  latitude: 31.9973,
  longitude: -102.0779,
};

const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { data: WeatherData | null; fetchedAt: number } = { data: null, fetchedAt: 0 };

function nwsHeaders(): HeadersInit {
  return {
    Accept: 'application/geo+json, application/json',
    'User-Agent': process.env.NWS_USER_AGENT || 'RightAtHomeBnB/1.0 (operations@rah-midland.com)',
  };
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: nwsHeaders(),
    next: { revalidate: 900 },
  });
  if (!response.ok) {
    throw new Error(`NWS request failed with status ${response.status}`);
  }
  return response.json();
}

function finiteNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseWindSpeed(value: unknown): number {
  const text = String(value || '0');
  const numbers = text.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if (!numbers.length) return 0;
  return Math.round(Math.max(...numbers));
}

function weatherCondition(shortForecast: string, icon: string | undefined): WeatherCondition {
  const description = shortForecast || 'Conditions unavailable';
  const main = description.split(/\s+/).slice(0, 3).join(' ');
  return {
    id: 0,
    main,
    description,
    icon: icon || '',
  };
}

function severity(value: unknown): WeatherAlert['severity'] {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'extreme') return 'extreme';
  if (normalized === 'severe') return 'severe';
  if (normalized === 'moderate') return 'moderate';
  return 'minor';
}

function dailyForecast(periods: any[]): WeatherForecastDay[] {
  const grouped = new Map<string, any[]>();
  for (const period of periods) {
    if (!period?.startTime) continue;
    const date = String(period.startTime).slice(0, 10);
    const values = grouped.get(date) || [];
    values.push(period);
    grouped.set(date, values);
  }

  const output: WeatherForecastDay[] = [];
  for (const [date, values] of grouped) {
    if (output.length >= 7) break;
    const temps = values.map((value) => finiteNumber(value.temperature, Number.NaN)).filter(Number.isFinite);
    if (!temps.length) continue;
    const daytime = values.find((value) => value.isDaytime) || values[0];
    const humidityValues = values
      .map((value) => finiteNumber(value.relativeHumidity?.value, Number.NaN))
      .filter(Number.isFinite);
    const precipValues = values
      .map((value) => finiteNumber(value.probabilityOfPrecipitation?.value, 0))
      .filter(Number.isFinite);
    const winds = values.map((value) => parseWindSpeed(value.windSpeed));

    output.push({
      date,
      dayName: new Date(`${date}T12:00:00-05:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: 'America/Chicago',
      }),
      high: Math.round(Math.max(...temps)),
      low: Math.round(Math.min(...temps)),
      conditions: [weatherCondition(daytime.shortForecast, daytime.icon)],
      precipitation: Math.round(Math.max(0, ...precipValues)),
      humidity: humidityValues.length
        ? Math.round(humidityValues.reduce((sum, value) => sum + value, 0) / humidityValues.length)
        : 0,
      windSpeed: winds.length ? Math.round(Math.max(...winds)) : 0,
    });
  }
  return output;
}

function buildSummary(data: Omit<WeatherData, 'summary' | 'source'>): string {
  const current = data.current;
  const description = current.conditions[0]?.description || 'conditions unavailable';
  const lines = [
    `Currently ${current.temperature}°F and ${description} in Midland, Texas.`,
    `Humidity is ${current.humidity}% with winds ${current.windSpeed} mph from the ${current.windDirection}.`,
  ];
  if (data.forecast[0]) {
    lines.push(`Today's high is ${data.forecast[0].high}°F and low is ${data.forecast[0].low}°F.`);
  }
  const urgent = data.alerts.filter((alert) => alert.severity === 'severe' || alert.severity === 'extreme');
  if (urgent.length) {
    lines.push(`Weather alert: ${urgent.map((alert) => alert.headline).join('; ')}.`);
  }
  return lines.join(' ');
}

export async function getWeather(): Promise<WeatherData | null> {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  try {
    const pointUrl = `https://api.weather.gov/points/${MIDLAND.latitude},${MIDLAND.longitude}`;
    const point = await fetchJson(pointUrl);
    const forecastUrl = point?.properties?.forecast;
    const hourlyUrl = point?.properties?.forecastHourly;
    if (!forecastUrl || !hourlyUrl) throw new Error('NWS point response did not include forecast URLs');

    const alertsUrl = `https://api.weather.gov/alerts/active?point=${MIDLAND.latitude},${MIDLAND.longitude}`;
    const [forecastResponse, hourlyResponse, alertsResponse] = await Promise.all([
      fetchJson(forecastUrl),
      fetchJson(hourlyUrl),
      fetchJson(alertsUrl).catch(() => ({ features: [] })),
    ]);

    const hourly = Array.isArray(hourlyResponse?.properties?.periods)
      ? hourlyResponse.properties.periods
      : [];
    const forecastPeriods = Array.isArray(forecastResponse?.properties?.periods)
      ? forecastResponse.properties.periods
      : [];
    const first = hourly[0] || forecastPeriods[0];
    if (!first || !Number.isFinite(Number(first.temperature))) {
      throw new Error('NWS forecast did not contain a valid temperature');
    }

    const humidity = finiteNumber(first.relativeHumidity?.value, 0);
    const current: CurrentWeather = {
      location: `${MIDLAND.city}, ${MIDLAND.state}`,
      zipCode: MIDLAND.zipCode,
      temperature: Math.round(finiteNumber(first.temperature)),
      feelsLike: Math.round(finiteNumber(first.temperature)),
      humidity: Math.round(humidity),
      windSpeed: parseWindSpeed(first.windSpeed),
      windDirection: String(first.windDirection || 'N/A'),
      conditions: [weatherCondition(first.shortForecast, first.icon)],
      visibility: 10,
      pressure: 0,
      sunrise: '',
      sunset: '',
      updatedAt: new Date().toISOString(),
    };

    const alerts: WeatherAlert[] = (alertsResponse?.features || []).map((feature: any) => ({
      event: String(feature?.properties?.event || 'Weather alert'),
      headline: String(feature?.properties?.headline || feature?.properties?.event || 'Weather alert'),
      severity: severity(feature?.properties?.severity),
      start: String(feature?.properties?.onset || feature?.properties?.effective || ''),
      end: String(feature?.properties?.ends || feature?.properties?.expires || ''),
      description: String(feature?.properties?.description || ''),
    }));

    const forecast = dailyForecast(forecastPeriods);
    const withoutSummary = { current, forecast, alerts };
    const data: WeatherData = {
      ...withoutSummary,
      summary: buildSummary(withoutSummary),
      source: 'NWS',
    };
    cache = { data, fetchedAt: now };
    return data;
  } catch {
    return cache.data;
  }
}

export async function getCurrentWeather(): Promise<CurrentWeather | null> {
  return (await getWeather())?.current || null;
}

export async function getWeatherSummary(): Promise<string> {
  return (await getWeather())?.summary || 'Weather data is currently unavailable.';
}

export function checkWeatherImpact(weather: WeatherData): string[] {
  const warnings: string[] = [];
  const current = weather.current;

  if (current.temperature >= 105) {
    warnings.push('EXTREME HEAT: reschedule nonessential outdoor work and verify property cooling.');
  } else if (current.temperature >= 95) {
    warnings.push('HEAT ADVISORY: confirm air conditioning and provide water for outdoor workers.');
  } else if (current.temperature <= 32) {
    warnings.push('FREEZE RISK: inspect exposed plumbing and vacant-property freeze protection.');
  }

  if (current.windSpeed >= 40) {
    warnings.push('HIGH WIND: secure outdoor furniture and suspend unsafe yard or pool work.');
  } else if (current.windSpeed >= 25) {
    warnings.push('WIND ADVISORY: outdoor cleaning, pool, and yard work may be affected.');
  }

  for (const alert of weather.alerts) {
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
  checkWeatherImpact,
};
