/**
 * Right at Home BnB - Thermostat Manager
 * Automates HVAC settings based on booking state, season, and vacancy.
 * Optimizes energy costs while ensuring guest comfort.
 *
 * Temperature values are in Fahrenheit (Midland, TX standard).
 * Uses the Setting model for thermostat state persistence.
 */

import prisma from '../prisma';
import { nowCST, startOfDay, addDays } from '../utils/dates';

// ============================================
// TYPES
// ============================================

export type ThermostatMode = 'heat' | 'cool' | 'auto' | 'off' | 'fan_only';
export type OccupancyState = 'occupied' | 'pre_arrival' | 'vacant' | 'post_checkout';

export interface ThermostatState {
  propertyId: string;
  currentTempF: number | null;
  targetTempF: number;
  mode: ThermostatMode;
  fanSpeed: 'auto' | 'low' | 'medium' | 'high';
  occupancyState: OccupancyState;
  lastUpdated: string;
  scheduleOverride: boolean;
}

export interface ThermostatSchedule {
  occupied: { heat: number; cool: number };
  preArrival: { heat: number; cool: number };
  vacant: { heat: number; cool: number };
  postCheckout: { heat: number; cool: number };
}

export interface EnergyReport {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  occupiedDays: number;
  vacantDays: number;
  estimatedSavingsCents: number;
  avgOccupiedTempF: number;
  avgVacantTempF: number;
}

// ============================================
// DEFAULTS
// ============================================

/**
 * Default temperature settings for Midland, TX.
 * Summers are brutal (100F+), winters are mild (30-50F).
 */
const DEFAULT_SCHEDULE: ThermostatSchedule = {
  occupied: { heat: 70, cool: 72 },      // Comfortable for guests
  preArrival: { heat: 70, cool: 72 },     // Ready for guest arrival
  vacant: { heat: 55, cool: 85 },         // Energy saving when empty
  postCheckout: { heat: 60, cool: 80 },   // Intermediate during turnover
};

/** How many hours before check-in to switch to pre-arrival mode */
const PRE_ARRIVAL_HOURS = 4;

/** How many hours after checkout to keep post-checkout before going to vacant */
const POST_CHECKOUT_HOURS = 6;

/** Minimum temperature to prevent pipe freezing (Midland can get below freezing) */
const FREEZE_PROTECTION_TEMP_F = 50;

/** Maximum vacant temp to prevent extreme heat damage */
const MAX_VACANT_TEMP_F = 90;

// ============================================
// STATE MANAGEMENT
// ============================================

/**
 * Get the current thermostat state for a property.
 * State is stored in the Setting model with key "thermostat:{propertyId}".
 */
export async function getThermostatState(propertyId: string): Promise<ThermostatState | null> {
  const setting = await prisma.setting.findUnique({
    where: { key: `thermostat:${propertyId}` },
  });

  if (!setting) return null;

  try {
    return JSON.parse(setting.value) as ThermostatState;
  } catch {
    return null;
  }
}

/**
 * Update the thermostat state for a property.
 */
async function saveThermostatState(state: ThermostatState): Promise<void> {
  const key = `thermostat:${state.propertyId}`;
  const value = JSON.stringify({ ...state, lastUpdated: new Date().toISOString() });

  await prisma.setting.upsert({
    where: { key },
    create: {
      key,
      value,
      description: `Thermostat state for property ${state.propertyId}`,
    },
    update: { value },
  });
}

/**
 * Get the custom schedule for a property, or return defaults.
 */
export async function getSchedule(propertyId: string): Promise<ThermostatSchedule> {
  const setting = await prisma.setting.findUnique({
    where: { key: `thermostat_schedule:${propertyId}` },
  });

  if (setting) {
    try {
      return JSON.parse(setting.value) as ThermostatSchedule;
    } catch {
      // Fall through to defaults
    }
  }

  return { ...DEFAULT_SCHEDULE };
}

/**
 * Save a custom schedule for a property.
 */
export async function setSchedule(propertyId: string, schedule: ThermostatSchedule): Promise<void> {
  // Validate temperatures are within sane bounds
  const allTemps = [
    schedule.occupied.heat, schedule.occupied.cool,
    schedule.preArrival.heat, schedule.preArrival.cool,
    schedule.vacant.heat, schedule.vacant.cool,
    schedule.postCheckout.heat, schedule.postCheckout.cool,
  ];

  for (const temp of allTemps) {
    if (temp < 45 || temp > 90) {
      throw new Error(`Temperature ${temp}F is outside safe bounds (45-90F)`);
    }
  }

  // Heat setpoint must be below cool setpoint
  const pairs = [schedule.occupied, schedule.preArrival, schedule.vacant, schedule.postCheckout];
  for (const pair of pairs) {
    if (pair.heat >= pair.cool) {
      throw new Error(`Heat setpoint (${pair.heat}F) must be below cool setpoint (${pair.cool}F)`);
    }
  }

  const key = `thermostat_schedule:${propertyId}`;
  await prisma.setting.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify(schedule),
      description: `Thermostat schedule for property ${propertyId}`,
    },
    update: { value: JSON.stringify(schedule) },
  });
}

// ============================================
// OCCUPANCY DETECTION
// ============================================

/**
 * Determine the current occupancy state of a property based on bookings.
 *
 * States:
 * - occupied: A guest is currently checked in
 * - pre_arrival: A guest arrives within PRE_ARRIVAL_HOURS
 * - post_checkout: A guest checked out within POST_CHECKOUT_HOURS
 * - vacant: No current or imminent bookings
 */
export async function determineOccupancyState(propertyId: string): Promise<OccupancyState> {
  const now = new Date();

  // Check for current booking (guest in-house)
  const currentBooking = await prisma.booking.findFirst({
    where: {
      propertyId,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkIn: { lte: now },
      checkOut: { gte: now },
    },
  });

  if (currentBooking) return 'occupied';

  // Check for upcoming booking within PRE_ARRIVAL_HOURS
  const preArrivalCutoff = new Date(now.getTime() + PRE_ARRIVAL_HOURS * 60 * 60 * 1000);
  const upcomingBooking = await prisma.booking.findFirst({
    where: {
      propertyId,
      status: { in: ['CONFIRMED'] },
      checkIn: {
        gt: now,
        lte: preArrivalCutoff,
      },
    },
  });

  if (upcomingBooking) return 'pre_arrival';

  // Check for recent checkout within POST_CHECKOUT_HOURS
  const postCheckoutCutoff = new Date(now.getTime() - POST_CHECKOUT_HOURS * 60 * 60 * 1000);
  const recentCheckout = await prisma.booking.findFirst({
    where: {
      propertyId,
      status: { in: ['CONFIRMED', 'COMPLETED', 'CHECKED_IN'] },
      checkOut: {
        gte: postCheckoutCutoff,
        lt: now,
      },
    },
  });

  if (recentCheckout) return 'post_checkout';

  return 'vacant';
}

// ============================================
// TEMPERATURE CALCULATION
// ============================================

/**
 * Get the season-aware mode for Midland, TX.
 * Midland is hot most of the year — cooling is the dominant need.
 */
function getSeasonalMode(date: Date): ThermostatMode {
  const month = date.getMonth(); // 0-indexed
  // Nov-Mar: heating season (Midland can freeze Dec-Feb)
  if (month >= 10 || month <= 2) return 'heat';
  // Apr-Oct: cooling season (Midland summers are 95-110F)
  return 'cool';
}

/**
 * Calculate the target temperature based on occupancy state and schedule.
 */
function calculateTargetTemp(
  occupancyState: OccupancyState,
  schedule: ThermostatSchedule,
  mode: ThermostatMode
): number {
  const key = mode === 'heat' ? 'heat' : 'cool';

  switch (occupancyState) {
    case 'occupied':
      return schedule.occupied[key];
    case 'pre_arrival':
      return schedule.preArrival[key];
    case 'post_checkout':
      return schedule.postCheckout[key];
    case 'vacant':
      return schedule.vacant[key];
    default:
      return schedule.vacant[key];
  }
}

// ============================================
// MAIN OPERATIONS
// ============================================

/**
 * Update the thermostat for a property based on its current occupancy state.
 * This is the main function called on a schedule (every 15-30 minutes).
 *
 * @param propertyId - The property to update
 * @returns The updated thermostat state
 */
export async function updateThermostat(propertyId: string): Promise<ThermostatState> {
  const currentState = await getThermostatState(propertyId);

  // If there's a manual override in place, don't change anything
  if (currentState?.scheduleOverride) {
    return currentState;
  }

  const occupancyState = await determineOccupancyState(propertyId);
  const schedule = await getSchedule(propertyId);
  const now = nowCST();
  const mode = getSeasonalMode(now);
  const targetTempF = calculateTargetTemp(occupancyState, schedule, mode);

  // Apply safety bounds
  const safeTarget = Math.max(FREEZE_PROTECTION_TEMP_F, Math.min(MAX_VACANT_TEMP_F, targetTempF));

  const newState: ThermostatState = {
    propertyId,
    currentTempF: currentState?.currentTempF ?? null,
    targetTempF: safeTarget,
    mode,
    fanSpeed: 'auto',
    occupancyState,
    lastUpdated: new Date().toISOString(),
    scheduleOverride: false,
  };

  await saveThermostatState(newState);

  // Log significant state changes
  if (!currentState || currentState.occupancyState !== occupancyState) {
    await prisma.auditLog.create({
      data: {
        action: 'THERMOSTAT_UPDATE',
        entity: 'Property',
        entityId: propertyId,
        newValues: JSON.stringify({
          occupancyState,
          targetTempF: safeTarget,
          mode,
          previousState: currentState?.occupancyState || 'unknown',
        }),
      },
    });
  }

  return newState;
}

/**
 * Manually override the thermostat for a property.
 * Override persists until clearOverride is called or the next booking state change.
 */
export async function setManualOverride(
  propertyId: string,
  targetTempF: number,
  mode: ThermostatMode
): Promise<ThermostatState> {
  if (targetTempF < 50 || targetTempF > 85) {
    throw new Error(`Target temperature ${targetTempF}F is outside allowed range (50-85F)`);
  }

  const currentState = await getThermostatState(propertyId);
  const occupancyState = currentState?.occupancyState ?? await determineOccupancyState(propertyId);

  const newState: ThermostatState = {
    propertyId,
    currentTempF: currentState?.currentTempF ?? null,
    targetTempF,
    mode,
    fanSpeed: 'auto',
    occupancyState,
    lastUpdated: new Date().toISOString(),
    scheduleOverride: true,
  };

  await saveThermostatState(newState);

  await prisma.auditLog.create({
    data: {
      action: 'THERMOSTAT_OVERRIDE',
      entity: 'Property',
      entityId: propertyId,
      newValues: JSON.stringify({ targetTempF, mode, override: true }),
    },
  });

  return newState;
}

/**
 * Clear a manual override and return to automatic scheduling.
 */
export async function clearOverride(propertyId: string): Promise<ThermostatState> {
  const currentState = await getThermostatState(propertyId);
  if (currentState) {
    currentState.scheduleOverride = false;
    await saveThermostatState(currentState);
  }

  // Immediately recalculate based on current occupancy
  return updateThermostat(propertyId);
}

/**
 * Update all property thermostats. Called by a scheduled cron job.
 * Returns the number of properties updated.
 */
export async function updateAllThermostats(): Promise<number> {
  const properties = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  let updatedCount = 0;
  for (const property of properties) {
    try {
      await updateThermostat(property.id);
      updatedCount++;
    } catch {
      // Log but continue with other properties
      console.error(`Failed to update thermostat for property ${property.id}`);
    }
  }

  return updatedCount;
}

/**
 * Estimate monthly energy savings from vacancy temperature management.
 * Uses a simplified model: ~$3/day saved per degree of setback.
 */
export async function estimateEnergySavings(
  propertyId: string,
  periodDays: number = 30
): Promise<EnergyReport> {
  const endDate = new Date();
  const startDate = addDays(endDate, -periodDays);

  // Count occupied vs vacant days
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      status: { notIn: ['CANCELLED', 'DECLINED'] },
      checkIn: { lt: endDate },
      checkOut: { gt: startDate },
    },
    select: { checkIn: true, checkOut: true },
  });

  let occupiedDays = 0;
  for (const booking of bookings) {
    const bookingStart = booking.checkIn > startDate ? booking.checkIn : startDate;
    const bookingEnd = booking.checkOut < endDate ? booking.checkOut : endDate;
    const days = Math.ceil((bookingEnd.getTime() - bookingStart.getTime()) / (1000 * 60 * 60 * 24));
    occupiedDays += Math.max(0, days);
  }
  occupiedDays = Math.min(occupiedDays, periodDays);
  const vacantDays = periodDays - occupiedDays;

  const schedule = await getSchedule(propertyId);

  // Average occupied and vacant temperatures
  const avgOccupiedTempF = (schedule.occupied.heat + schedule.occupied.cool) / 2;
  const avgVacantTempF = (schedule.vacant.heat + schedule.vacant.cool) / 2;

  // Estimated savings: $3/day per degree of setback during vacancy
  const degreeDiff = Math.abs(avgOccupiedTempF - avgVacantTempF);
  const dailySavingsCents = Math.round(degreeDiff * 300); // $3/degree/day in cents
  const estimatedSavingsCents = dailySavingsCents * vacantDays;

  return {
    propertyId,
    periodStart: startDate.toISOString().split('T')[0],
    periodEnd: endDate.toISOString().split('T')[0],
    occupiedDays,
    vacantDays,
    estimatedSavingsCents,
    avgOccupiedTempF,
    avgVacantTempF,
  };
}
