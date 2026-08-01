from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src\renderer\services\pricing.ts")
text = path.read_text(encoding="utf-8")
anchor = "export const pricingService = new PricingService();\n"
addition = r'''export const pricingService = new PricingService();

export interface LegacyPricingProperty {
  id?: string;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  weeklyDiscount?: number;
  monthlyDiscount?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
}

function clampPrice(property: LegacyPricingProperty, price: number): number {
  const minimum = property.minPrice ?? 0;
  const maximum = property.maxPrice ?? Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(minimum, Math.round(price * 100) / 100));
}

export function getBasePrice(property: LegacyPricingProperty): number {
  return property.basePrice;
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function getDayOfWeekMultiplier(date: Date): number {
  return isWeekend(date) ? 1.15 : 1;
}

export function getSeasonalMultiplier(date: Date): number {
  const month = date.getUTCMonth();
  if (month === 0 || month === 1) return 0.9;
  if (month >= 5 && month <= 7) return 1.15;
  if (month >= 8 && month <= 10) return 1.1;
  if (month === 11) return 1.2;
  return 1;
}

function thanksgivingDate(year: number): number {
  const first = new Date(Date.UTC(year, 10, 1));
  const firstThursday = 1 + ((4 - first.getUTCDay() + 7) % 7);
  return firstThursday + 21;
}

export function isHolidayPeriod(date: Date): boolean {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  if (month === 6 && day === 4) return true;
  if (month === 11 && day >= 20) return true;
  if (month === 0 && day <= 2) return true;
  if (month === 10 && day === thanksgivingDate(year)) return true;
  return false;
}

export function calculatePrice(
  property: LegacyPricingProperty,
  date: Date,
  options: { demandMultiplier?: number } = {}
): number {
  let price = property.basePrice;
  price *= getSeasonalMultiplier(date);
  price *= getDayOfWeekMultiplier(date);
  if (isHolidayPeriod(date)) price *= 1.3;
  price *= options.demandMultiplier ?? 1;
  return clampPrice(property, price);
}

export function calculateDemandMultiplier(input: {
  bookedNights: number;
  totalNights: number;
}): number {
  if (input.totalNights <= 0) return 1;
  const occupancy = Math.min(1, Math.max(0, input.bookedNights / input.totalNights));
  if (occupancy >= 0.85) return 1.35;
  if (occupancy >= 0.7) return 1.2;
  if (occupancy <= 0.35) return 0.85;
  if (occupancy <= 0.55) return 0.95;
  return 1.05;
}

export function calculateTotalWithDiscount(
  property: LegacyPricingProperty,
  nights: number
): number {
  if (!Number.isFinite(nights) || nights < 0) {
    throw new RangeError('Nights must be a non-negative number');
  }
  let discount = 0;
  if (nights >= 30) discount = property.monthlyDiscount ?? property.weeklyDiscount ?? 0;
  else if (nights >= 7) discount = property.weeklyDiscount ?? 0;
  return property.basePrice * nights * (1 - discount);
}

export function calculateLastMinutePrice(
  property: LegacyPricingProperty,
  checkIn: Date
): number {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const checkInUtc = Date.UTC(
    checkIn.getUTCFullYear(),
    checkIn.getUTCMonth(),
    checkIn.getUTCDate()
  );
  const daysOut = Math.round((checkInUtc - todayUtc) / (24 * 60 * 60 * 1000));
  const discount = daysOut >= 0 && daysOut <= 3 ? 0.15 : 0;
  return clampPrice(property, property.basePrice * (1 - discount));
}

export function adjustForCompetition(
  property: LegacyPricingProperty,
  competitorPrices: number[]
): number {
  const valid = competitorPrices.filter((price) => Number.isFinite(price) && price > 0);
  if (valid.length === 0) return clampPrice(property, property.basePrice);
  const average = valid.reduce((sum, price) => sum + price, 0) / valid.length;
  const target = Math.min(property.basePrice, average * 0.98);
  return clampPrice(property, target);
}

export function calculateMarketPosition(
  ourPrice: number,
  competitorPrices: number[]
): number {
  const valid = competitorPrices.filter((price) => Number.isFinite(price));
  if (valid.length === 0) return 0.5;
  const below = valid.filter((price) => price < ourPrice).length;
  const equal = valid.filter((price) => price === ourPrice).length;
  return (below + equal * 0.5) / valid.length;
}

export function generateRecommendation(
  property: LegacyPricingProperty,
  date: Date
): {
  suggestedPrice: number;
  factors: string[];
  confidence: number;
} {
  const factors: string[] = [];
  const season = getSeasonalMultiplier(date);
  if (season > 1) factors.push('Seasonal premium');
  if (season < 1) factors.push('Off-season adjustment');
  if (isWeekend(date)) factors.push('Weekend premium');
  if (isHolidayPeriod(date)) factors.push('Holiday premium');
  if (factors.length === 0) factors.push('Base market rate');
  return {
    suggestedPrice: calculatePrice(property, date),
    factors,
    confidence: Math.min(0.95, 0.7 + factors.length * 0.05),
  };
}

export function calculateExpectedRevenue(
  price: number,
  occupancyRate: number,
  nights: number
): number {
  return price * occupancyRate * nights;
}

export function calculateOptimalPrice(
  property: LegacyPricingProperty,
  historicalData: Array<{ price: number; occupancy: number }>
): number {
  const valid = historicalData.filter(
    (row) => Number.isFinite(row.price) && Number.isFinite(row.occupancy)
  );
  if (valid.length === 0) return clampPrice(property, property.basePrice);
  const best = valid.reduce((current, candidate) =>
    candidate.price * candidate.occupancy > current.price * current.occupancy
      ? candidate
      : current
  );
  return clampPrice(property, best.price);
}
'''
if anchor not in text:
    raise SystemExit("Pricing export anchor not found")
path.write_text(text.replace(anchor, addition, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
