import { getWeather, checkWeatherImpact } from '@/lib/weather';

const MIDLAND = {
  latitude: 31.9973,
  longitude: -102.0779,
  city: 'Midland',
  state: 'TX',
  country: 'US',
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

export type PlaceCategory = 'food' | 'shopping' | 'music' | 'nightlife';

export interface ProviderState {
  provider: string;
  available: boolean;
  fetchedAt: string;
  reason?: string;
}

export interface AreaPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  websiteUrl: string | null;
  mapsUrl: string;
}

export interface AreaEvent {
  id: string;
  name: string;
  startDate: string | null;
  startTime: string | null;
  venueName: string | null;
  address: string | null;
  city: string | null;
  classification: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  mapsUrl: string | null;
}

export interface NewsHeadline {
  title: string;
  description: string | null;
  source: string;
  publishedAt: string | null;
  url: string;
  imageUrl: string | null;
}

export interface AreaIntelligence {
  location: typeof MIDLAND;
  map: {
    center: { latitude: number; longitude: number };
    searchUrl: string;
  };
  weather: Awaited<ReturnType<typeof getWeather>>;
  weatherWarnings: string[];
  places: Record<PlaceCategory, AreaPlace[]>;
  events: AreaEvent[];
  news: {
    local: NewsHeadline[];
    national: NewsHeadline[];
  };
  providers: ProviderState[];
  generatedAt: string;
}

function cleanText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value as T;
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`provider returned status ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

const placeQueries: Record<PlaceCategory, string> = {
  food: 'restaurants and coffee near Midland Texas',
  shopping: 'shopping and grocery stores near Midland Texas',
  music: 'live music venues near Midland Texas',
  nightlife: 'nightlife and entertainment near Midland Texas',
};

async function fetchPlaces(category: PlaceCategory): Promise<{ items: AreaPlace[]; state: ProviderState }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const fetchedAt = new Date().toISOString();
  if (!apiKey) {
    return {
      items: [],
      state: { provider: `google-places:${category}`, available: false, fetchedAt, reason: 'not configured' },
    };
  }

  try {
    const data = await cached(`places:${category}`, () =>
      fetchJson('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.location',
            'places.rating',
            'places.userRatingCount',
            'places.priceLevel',
            'places.currentOpeningHours.openNow',
            'places.websiteUri',
            'places.googleMapsUri',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: placeQueries[category],
          locationBias: {
            circle: {
              center: { latitude: MIDLAND.latitude, longitude: MIDLAND.longitude },
              radius: 45_000,
            },
          },
          maxResultCount: 12,
          languageCode: 'en',
          regionCode: 'US',
        }),
      }),
    );

    const items = (data?.places || []).slice(0, 12).map((place: any): AreaPlace => {
      const name = cleanText(place?.displayName?.text, 120) || 'Unnamed place';
      const address = cleanText(place?.formattedAddress, 250);
      return {
        id: String(place?.id || `${category}-${name}`),
        name,
        category,
        address,
        latitude: Number.isFinite(Number(place?.location?.latitude)) ? Number(place.location.latitude) : null,
        longitude: Number.isFinite(Number(place?.location?.longitude)) ? Number(place.location.longitude) : null,
        rating: Number.isFinite(Number(place?.rating)) ? Number(place.rating) : null,
        ratingCount: Number.isFinite(Number(place?.userRatingCount)) ? Number(place.userRatingCount) : null,
        priceLevel: cleanText(place?.priceLevel, 30),
        openNow: typeof place?.currentOpeningHours?.openNow === 'boolean' ? place.currentOpeningHours.openNow : null,
        websiteUrl: safeUrl(place?.websiteUri),
        mapsUrl: safeUrl(place?.googleMapsUri) || mapsSearchUrl(`${name} ${address || 'Midland TX'}`),
      };
    });

    return { items, state: { provider: `google-places:${category}`, available: true, fetchedAt } };
  } catch (error) {
    return {
      items: [],
      state: {
        provider: `google-places:${category}`,
        available: false,
        fetchedAt,
        reason: error instanceof Error ? error.message.slice(0, 160) : 'request failed',
      },
    };
  }
}

async function fetchEvents(): Promise<{ items: AreaEvent[]; state: ProviderState }> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  const fetchedAt = new Date().toISOString();
  if (!apiKey) {
    return { items: [], state: { provider: 'ticketmaster', available: false, fetchedAt, reason: 'not configured' } };
  }

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      latlong: `${MIDLAND.latitude},${MIDLAND.longitude}`,
      radius: '100',
      unit: 'miles',
      size: '30',
      sort: 'date,asc',
      locale: '*',
    });
    const data = await cached('events', () =>
      fetchJson(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`),
    );
    const items = (data?._embedded?.events || []).slice(0, 30).map((event: any): AreaEvent => {
      const venue = event?._embedded?.venues?.[0];
      const addressParts = [venue?.address?.line1, venue?.city?.name, venue?.state?.stateCode, venue?.postalCode]
        .filter(Boolean)
        .join(', ');
      return {
        id: String(event?.id || event?.url || event?.name),
        name: cleanText(event?.name, 180) || 'Unnamed event',
        startDate: cleanText(event?.dates?.start?.localDate, 20),
        startTime: cleanText(event?.dates?.start?.localTime, 20),
        venueName: cleanText(venue?.name, 150),
        address: cleanText(addressParts, 250),
        city: cleanText(venue?.city?.name, 100),
        classification: cleanText(event?.classifications?.[0]?.segment?.name, 80),
        ticketUrl: safeUrl(event?.url),
        imageUrl: safeUrl(event?.images?.find((image: any) => image?.ratio === '16_9')?.url || event?.images?.[0]?.url),
        mapsUrl: venue ? mapsSearchUrl(`${venue.name || ''} ${addressParts}`.trim()) : null,
      };
    });
    return { items, state: { provider: 'ticketmaster', available: true, fetchedAt } };
  } catch (error) {
    return {
      items: [],
      state: {
        provider: 'ticketmaster',
        available: false,
        fetchedAt,
        reason: error instanceof Error ? error.message.slice(0, 160) : 'request failed',
      },
    };
  }
}

function mapArticles(articles: any[]): NewsHeadline[] {
  return (articles || [])
    .map((article): NewsHeadline | null => {
      const title = cleanText(article?.title, 240);
      const url = safeUrl(article?.url);
      if (!title || !url || title === '[Removed]') return null;
      return {
        title,
        description: cleanText(article?.description, 500),
        source: cleanText(article?.source?.name, 120) || 'Unknown source',
        publishedAt: cleanText(article?.publishedAt, 40),
        url,
        imageUrl: safeUrl(article?.urlToImage),
      };
    })
    .filter(Boolean)
    .slice(0, 20) as NewsHeadline[];
}

async function fetchNews(kind: 'local' | 'national'): Promise<{ items: NewsHeadline[]; state: ProviderState }> {
  const apiKey = process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY;
  const fetchedAt = new Date().toISOString();
  if (!apiKey) {
    return { items: [], state: { provider: `newsapi:${kind}`, available: false, fetchedAt, reason: 'not configured' } };
  }

  try {
    let url: string;
    if (kind === 'local') {
      const params = new URLSearchParams({
        q: '(Midland Texas OR Odessa Texas OR Permian Basin)',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: '20',
        apiKey,
      });
      url = `https://newsapi.org/v2/everything?${params}`;
    } else {
      const params = new URLSearchParams({ country: 'us', pageSize: '20', apiKey });
      url = `https://newsapi.org/v2/top-headlines?${params}`;
    }
    const data = await cached(`news:${kind}`, () => fetchJson(url));
    return {
      items: mapArticles(data?.articles),
      state: { provider: `newsapi:${kind}`, available: true, fetchedAt },
    };
  } catch (error) {
    return {
      items: [],
      state: {
        provider: `newsapi:${kind}`,
        available: false,
        fetchedAt,
        reason: error instanceof Error ? error.message.slice(0, 160) : 'request failed',
      },
    };
  }
}

export async function getAreaIntelligence(): Promise<AreaIntelligence> {
  const [weather, food, shopping, music, nightlife, events, localNews, nationalNews] = await Promise.all([
    getWeather(),
    fetchPlaces('food'),
    fetchPlaces('shopping'),
    fetchPlaces('music'),
    fetchPlaces('nightlife'),
    fetchEvents(),
    fetchNews('local'),
    fetchNews('national'),
  ]);

  const weatherState: ProviderState = {
    provider: 'national-weather-service',
    available: Boolean(weather),
    fetchedAt: new Date().toISOString(),
    reason: weather ? undefined : 'weather unavailable',
  };

  return {
    location: MIDLAND,
    map: {
      center: { latitude: MIDLAND.latitude, longitude: MIDLAND.longitude },
      searchUrl: mapsSearchUrl('Midland Texas'),
    },
    weather,
    weatherWarnings: weather ? checkWeatherImpact(weather) : [],
    places: {
      food: food.items,
      shopping: shopping.items,
      music: music.items,
      nightlife: nightlife.items,
    },
    events: events.items,
    news: {
      local: localNews.items,
      national: nationalNews.items,
    },
    providers: [
      weatherState,
      food.state,
      shopping.state,
      music.state,
      nightlife.state,
      events.state,
      localNews.state,
      nationalNews.state,
    ],
    generatedAt: new Date().toISOString(),
  };
}
