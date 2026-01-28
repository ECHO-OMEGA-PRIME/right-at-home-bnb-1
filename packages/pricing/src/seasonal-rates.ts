/**
 * Right at Home BnB - Seasonal Rates
 * Seasonal pricing configuration for Midland, TX vacation rentals
 */

import type {
  SeasonalMultiplier,
  SeasonDefinition,
  EventPricing,
  MidlandEvents,
} from './types';

/**
 * Midland, TX seasonal definitions
 * Based on local tourism patterns and oil industry activity
 */
export const MIDLAND_SEASONS: SeasonDefinition[] = [
  {
    name: 'Peak Oil Season',
    type: 'peak',
    months: [9, 10, 11], // Sept-Nov (fall drilling season)
    multiplier: 1.35,
  },
  {
    name: 'Spring Oil Season',
    type: 'high',
    months: [3, 4, 5], // Mar-May (spring drilling season)
    multiplier: 1.25,
  },
  {
    name: 'Summer',
    type: 'shoulder',
    months: [6, 7, 8], // June-Aug (hot, but steady business travel)
    multiplier: 1.0,
  },
  {
    name: 'Winter Holidays',
    type: 'high',
    months: [12], // December
    multiplier: 1.2,
  },
  {
    name: 'Early Year',
    type: 'low',
    months: [1, 2], // Jan-Feb (slower period)
    multiplier: 0.9,
  },
];

/**
 * Detailed seasonal multipliers with specific date ranges
 */
export const SEASONAL_MULTIPLIERS: SeasonalMultiplier[] = [
  // Peak Oil Season (Fall) - September through November
  {
    name: 'Peak Fall Drilling Season',
    startMonth: 9,
    startDay: 1,
    endMonth: 11,
    endDay: 30,
    multiplier: 1.35,
    priority: 1,
  },
  // Permian Basin Oil Show (major biennial event)
  {
    name: 'Permian Basin Oil Show',
    startMonth: 10,
    startDay: 15,
    endMonth: 10,
    endDay: 20,
    multiplier: 1.75,
    priority: 10,
  },
  // Spring Drilling Season
  {
    name: 'Spring Drilling Season',
    startMonth: 3,
    startDay: 1,
    endMonth: 5,
    endDay: 31,
    multiplier: 1.25,
    priority: 1,
  },
  // Summer - steady but not peak
  {
    name: 'Summer Season',
    startMonth: 6,
    startDay: 1,
    endMonth: 8,
    endDay: 31,
    multiplier: 1.0,
    priority: 1,
  },
  // Winter Holidays
  {
    name: 'Christmas/New Year',
    startMonth: 12,
    startDay: 20,
    endMonth: 1,
    endDay: 2,
    multiplier: 1.4,
    priority: 5,
  },
  // Thanksgiving
  {
    name: 'Thanksgiving Week',
    startMonth: 11,
    startDay: 20,
    endMonth: 11,
    endDay: 30,
    multiplier: 1.45,
    priority: 5,
  },
  // Slow Season
  {
    name: 'Winter Slow Season',
    startMonth: 1,
    startDay: 3,
    endMonth: 2,
    endDay: 28,
    multiplier: 0.85,
    priority: 1,
  },
  // July 4th
  {
    name: 'July 4th Week',
    startMonth: 7,
    startDay: 1,
    endMonth: 7,
    endDay: 7,
    multiplier: 1.25,
    priority: 5,
  },
  // Labor Day
  {
    name: 'Labor Day Weekend',
    startMonth: 9,
    startDay: 1,
    endMonth: 9,
    endDay: 7,
    multiplier: 1.3,
    priority: 5,
  },
  // Memorial Day
  {
    name: 'Memorial Day Weekend',
    startMonth: 5,
    startDay: 25,
    endMonth: 5,
    endDay: 31,
    multiplier: 1.25,
    priority: 5,
  },
];

/**
 * Get Midland-specific events with dynamic pricing
 */
export function getMidlandEvents(year: number): MidlandEvents {
  const oilIndustryEvents: EventPricing[] = [
    // Permian Basin Oil Show - major biennial event
    {
      name: 'Permian Basin International Oil Show',
      startDate: new Date(year, 9, 15), // Mid-October
      endDate: new Date(year, 9, 20),
      multiplier: 1.75,
      minStay: 2,
    },
    // PBPA (Permian Basin Petroleum Association) events
    {
      name: 'PBPA Annual Meeting',
      startDate: new Date(year, 3, 10),
      endDate: new Date(year, 3, 12),
      multiplier: 1.4,
    },
    // SPE (Society of Petroleum Engineers) events
    {
      name: 'SPE Permian Basin Conference',
      startDate: new Date(year, 4, 5),
      endDate: new Date(year, 4, 7),
      multiplier: 1.35,
    },
  ];

  const localEvents: EventPricing[] = [
    // Midland RockHounds (baseball) season
    {
      name: 'RockHounds Opening Weekend',
      startDate: new Date(year, 3, 8),
      endDate: new Date(year, 3, 10),
      multiplier: 1.15,
    },
    // Celebration of the Arts
    {
      name: 'Celebration of the Arts',
      startDate: new Date(year, 8, 15),
      endDate: new Date(year, 8, 17),
      multiplier: 1.2,
    },
    // West Texas Fair & Rodeo (Abilene, but draws Midland visitors)
    {
      name: 'West Texas Fair',
      startDate: new Date(year, 8, 8),
      endDate: new Date(year, 8, 17),
      multiplier: 1.1,
    },
    // Tall City Blues Fest
    {
      name: 'Tall City Blues Fest',
      startDate: new Date(year, 5, 10),
      endDate: new Date(year, 5, 12),
      multiplier: 1.2,
    },
  ];

  const holidays: EventPricing[] = [
    // New Year's
    {
      name: "New Year's Holiday",
      startDate: new Date(year, 11, 30),
      endDate: new Date(year + 1, 0, 2),
      multiplier: 1.45,
      minStay: 2,
    },
    // MLK Weekend
    {
      name: 'MLK Weekend',
      startDate: new Date(year, 0, 14),
      endDate: new Date(year, 0, 16),
      multiplier: 1.15,
    },
    // Presidents Day
    {
      name: 'Presidents Day Weekend',
      startDate: new Date(year, 1, 17),
      endDate: new Date(year, 1, 19),
      multiplier: 1.15,
    },
    // Easter
    {
      name: 'Easter Weekend',
      startDate: new Date(year, 3, 1), // Approximate - should calculate actual date
      endDate: new Date(year, 3, 3),
      multiplier: 1.2,
    },
    // Memorial Day
    {
      name: 'Memorial Day Weekend',
      startDate: new Date(year, 4, 25),
      endDate: new Date(year, 4, 28),
      multiplier: 1.3,
      minStay: 2,
    },
    // July 4th
    {
      name: 'Independence Day',
      startDate: new Date(year, 6, 1),
      endDate: new Date(year, 6, 7),
      multiplier: 1.35,
      minStay: 2,
    },
    // Labor Day
    {
      name: 'Labor Day Weekend',
      startDate: new Date(year, 8, 1),
      endDate: new Date(year, 8, 4),
      multiplier: 1.35,
      minStay: 2,
    },
    // Thanksgiving
    {
      name: 'Thanksgiving',
      startDate: new Date(year, 10, 20),
      endDate: new Date(year, 10, 26),
      multiplier: 1.5,
      minStay: 3,
    },
    // Christmas
    {
      name: 'Christmas Holiday',
      startDate: new Date(year, 11, 20),
      endDate: new Date(year, 11, 28),
      multiplier: 1.5,
      minStay: 3,
    },
  ];

  return {
    oilIndustryEvents,
    localEvents,
    holidays,
  };
}

/**
 * Seasonal rates manager
 */
export class SeasonalRatesManager {
  private seasonalMultipliers: SeasonalMultiplier[];
  private events: MidlandEvents;
  private currentYear: number;

  constructor(year?: number) {
    this.currentYear = year || new Date().getFullYear();
    this.seasonalMultipliers = SEASONAL_MULTIPLIERS;
    this.events = getMidlandEvents(this.currentYear);
  }

  /**
   * Get the seasonal multiplier for a specific date
   */
  getSeasonalMultiplier(date: Date): { multiplier: number; name: string; type: string } {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Find highest priority matching seasonal multiplier
    let bestMatch: SeasonalMultiplier | null = null;

    for (const season of this.seasonalMultipliers) {
      if (this.dateInRange(month, day, season)) {
        if (!bestMatch || season.priority > bestMatch.priority) {
          bestMatch = season;
        }
      }
    }

    if (bestMatch) {
      return {
        multiplier: bestMatch.multiplier,
        name: bestMatch.name,
        type: 'seasonal',
      };
    }

    return {
      multiplier: 1.0,
      name: 'Standard Rate',
      type: 'standard',
    };
  }

  /**
   * Check if a date is within a seasonal range
   */
  private dateInRange(month: number, day: number, season: SeasonalMultiplier): boolean {
    const startDate = season.startMonth * 100 + season.startDay;
    const endDate = season.endMonth * 100 + season.endDay;
    const checkDate = month * 100 + day;

    // Handle year-wrapping ranges (e.g., Dec 20 - Jan 2)
    if (startDate > endDate) {
      return checkDate >= startDate || checkDate <= endDate;
    }

    return checkDate >= startDate && checkDate <= endDate;
  }

  /**
   * Get event pricing for a specific date
   */
  getEventPricing(date: Date): EventPricing | null {
    const allEvents = [
      ...this.events.oilIndustryEvents,
      ...this.events.localEvents,
      ...this.events.holidays,
    ];

    const dateTime = date.getTime();

    for (const event of allEvents) {
      if (dateTime >= event.startDate.getTime() && dateTime <= event.endDate.getTime()) {
        return event;
      }
    }

    return null;
  }

  /**
   * Get weekend multiplier
   */
  getWeekendMultiplier(date: Date): number {
    const dayOfWeek = date.getDay();
    // Friday (5) and Saturday (6) get weekend premium
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      return 1.15; // 15% weekend markup
    }
    return 1.0;
  }

  /**
   * Get all applicable multipliers for a date
   */
  getAllMultipliers(date: Date): Array<{ name: string; multiplier: number; type: string }> {
    const multipliers: Array<{ name: string; multiplier: number; type: string }> = [];

    // Seasonal multiplier
    const seasonal = this.getSeasonalMultiplier(date);
    if (seasonal.multiplier !== 1.0) {
      multipliers.push(seasonal);
    }

    // Event pricing (takes precedence over seasonal)
    const event = this.getEventPricing(date);
    if (event) {
      multipliers.push({
        name: event.name,
        multiplier: event.multiplier,
        type: 'event',
      });
    }

    // Weekend multiplier
    const weekendMult = this.getWeekendMultiplier(date);
    if (weekendMult > 1.0) {
      multipliers.push({
        name: 'Weekend Premium',
        multiplier: weekendMult,
        type: 'weekend',
      });
    }

    return multipliers;
  }

  /**
   * Calculate combined multiplier for a date
   */
  getCombinedMultiplier(date: Date): number {
    const multipliers = this.getAllMultipliers(date);

    if (multipliers.length === 0) {
      return 1.0;
    }

    // Use the highest event multiplier if present, otherwise combine
    const eventMultiplier = multipliers.find((m) => m.type === 'event');
    if (eventMultiplier) {
      // Event pricing is the primary driver
      const weekendMultiplier = multipliers.find((m) => m.type === 'weekend');
      return eventMultiplier.multiplier * (weekendMultiplier?.multiplier || 1.0);
    }

    // Combine seasonal and weekend
    return multipliers.reduce((total, m) => total * m.multiplier, 1.0);
  }

  /**
   * Get upcoming events
   */
  getUpcomingEvents(days: number = 90): EventPricing[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const allEvents = [
      ...this.events.oilIndustryEvents,
      ...this.events.localEvents,
      ...this.events.holidays,
    ];

    return allEvents
      .filter((event) => event.startDate >= now && event.startDate <= future)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  /**
   * Get season name for a date
   */
  getSeasonName(date: Date): string {
    const month = date.getMonth() + 1;
    const season = MIDLAND_SEASONS.find((s) => s.months.includes(month));
    return season?.name || 'Standard Season';
  }

  /**
   * Refresh events for a new year
   */
  refreshYear(year: number): void {
    this.currentYear = year;
    this.events = getMidlandEvents(year);
  }

  /**
   * Add custom event
   */
  addCustomEvent(event: EventPricing): void {
    this.events.localEvents.push(event);
  }

  /**
   * Get minimum stay for a date
   */
  getMinimumStay(date: Date): number {
    const event = this.getEventPricing(date);
    if (event?.minStay) {
      return event.minStay;
    }

    // Weekend minimum
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      return 2; // 2-night minimum on weekends
    }

    return 1; // Default 1-night minimum
  }
}

export const seasonalRatesManager = new SeasonalRatesManager();
