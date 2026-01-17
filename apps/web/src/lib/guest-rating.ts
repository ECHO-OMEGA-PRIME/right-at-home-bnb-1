'use client';

/**
 * Right at Home BnB - Guest Rating Algorithm
 * Comprehensive guest scoring based on spending, behavior, reviews, and damage history
 * @author ECHO OMEGA PRIME
 */

import { GuestProfile } from './crm';

// Damage Report Interface
export interface DamageReport {
  id: string;
  guestEmail: string;
  propertyId: string;
  propertyName: string;
  bookingId: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'severe';
  cost: number;
  isPaid: boolean;
  wasCharged: boolean;
  chargeAmount?: number;
  photos?: string[];
  reportedDate: string;
  resolvedDate?: string;
  notes?: string;
}

// Rating Factors
export interface GuestRatingFactors {
  spendingScore: number;       // 0-100: Based on total spending
  visitFrequencyScore: number; // 0-100: Based on number of visits
  reviewBehaviorScore: number; // 0-100: Based on leaving reviews and their quality
  damageHistoryScore: number;  // 0-100: Based on damage incidents
  communicationScore: number;  // 0-100: Based on responsiveness
  ruleComplianceScore: number; // 0-100: Based on following house rules
  paymentScore: number;        // 0-100: Based on payment timeliness
}

// Comprehensive Guest Rating
export interface GuestRating {
  overallScore: number;        // 1-10 scale
  tier: 'VIP' | 'Excellent' | 'Good' | 'Average' | 'Caution' | 'Restricted';
  factors: GuestRatingFactors;
  recommendations: string[];
  lastCalculated: string;
}

// Rating weights (must sum to 1)
const RATING_WEIGHTS = {
  spending: 0.20,
  visitFrequency: 0.15,
  reviewBehavior: 0.20,
  damageHistory: 0.20,
  communication: 0.10,
  ruleCompliance: 0.10,
  payment: 0.05,
};

// Spending thresholds
const SPENDING_TIERS = [
  { min: 10000, score: 100 },
  { min: 5000, score: 90 },
  { min: 2500, score: 80 },
  { min: 1000, score: 70 },
  { min: 500, score: 60 },
  { min: 250, score: 50 },
  { min: 100, score: 40 },
  { min: 0, score: 30 },
];

// Visit frequency thresholds
const VISIT_TIERS = [
  { min: 10, score: 100 },
  { min: 5, score: 90 },
  { min: 3, score: 80 },
  { min: 2, score: 70 },
  { min: 1, score: 50 },
];

// Calculate spending score
function calculateSpendingScore(totalSpent: number): number {
  for (const tier of SPENDING_TIERS) {
    if (totalSpent >= tier.min) {
      return tier.score;
    }
  }
  return 30;
}

// Calculate visit frequency score
function calculateVisitScore(totalVisits: number): number {
  for (const tier of VISIT_TIERS) {
    if (totalVisits >= tier.min) {
      return tier.score;
    }
  }
  return 30;
}

// Calculate review behavior score
function calculateReviewBehaviorScore(
  reviewsGiven: number,
  totalStays: number,
  averageRatingGiven: number
): number {
  if (totalStays === 0) return 50; // No data

  // Review rate (did they leave reviews?)
  const reviewRate = reviewsGiven / totalStays;

  // Base score for leaving reviews
  let score = 0;

  if (reviewRate >= 0.8) {
    score = 80; // Excellent - reviews most stays
  } else if (reviewRate >= 0.5) {
    score = 70; // Good - reviews half their stays
  } else if (reviewRate >= 0.25) {
    score = 55; // Fair - sometimes reviews
  } else if (reviewRate > 0) {
    score = 45; // Rarely reviews
  } else {
    score = 35; // Never reviews - neutral but not ideal
  }

  // Bonus/penalty for review quality
  // High ratings (4-5) are good for business, very low ratings might indicate unreasonable expectations
  if (averageRatingGiven >= 4.5) {
    score += 15; // Generous reviewer
  } else if (averageRatingGiven >= 4.0) {
    score += 10; // Fair reviewer
  } else if (averageRatingGiven >= 3.5) {
    score += 5; // Slightly critical
  } else if (averageRatingGiven < 3.0 && reviewsGiven > 2) {
    score -= 10; // Consistently harsh reviewer (potential problem guest)
  }

  return Math.min(100, Math.max(0, score));
}

// Calculate damage history score
function calculateDamageScore(damageReports: DamageReport[]): number {
  if (damageReports.length === 0) return 100; // No damage - perfect

  let score = 100;

  for (const damage of damageReports) {
    // Deduct based on severity
    switch (damage.severity) {
      case 'minor':
        score -= 5;
        break;
      case 'moderate':
        score -= 15;
        break;
      case 'major':
        score -= 30;
        break;
      case 'severe':
        score -= 50;
        break;
    }

    // Additional penalty if damage wasn't paid for
    if (!damage.isPaid && damage.cost > 0) {
      score -= 10;
    }
  }

  return Math.max(0, score);
}

// Calculate overall guest rating
export function calculateGuestRating(
  guest: GuestProfile,
  damageReports: DamageReport[] = [],
  communicationScore: number = 70, // Default average
  ruleComplianceScore: number = 80, // Default good
  paymentScore: number = 90 // Default excellent
): GuestRating {
  const factors: GuestRatingFactors = {
    spendingScore: calculateSpendingScore(guest.totalSpent),
    visitFrequencyScore: calculateVisitScore(guest.totalVisits),
    reviewBehaviorScore: calculateReviewBehaviorScore(
      guest.reviewsGiven?.length || 0,
      guest.totalVisits,
      guest.averageRatingGiven || 4.0
    ),
    damageHistoryScore: calculateDamageScore(damageReports),
    communicationScore,
    ruleComplianceScore,
    paymentScore,
  };

  // Calculate weighted overall score (0-100)
  const weightedScore =
    factors.spendingScore * RATING_WEIGHTS.spending +
    factors.visitFrequencyScore * RATING_WEIGHTS.visitFrequency +
    factors.reviewBehaviorScore * RATING_WEIGHTS.reviewBehavior +
    factors.damageHistoryScore * RATING_WEIGHTS.damageHistory +
    factors.communicationScore * RATING_WEIGHTS.communication +
    factors.ruleComplianceScore * RATING_WEIGHTS.ruleCompliance +
    factors.paymentScore * RATING_WEIGHTS.payment;

  // Convert to 1-10 scale
  const overallScore = Math.round((weightedScore / 10) * 10) / 10;

  // Determine tier
  let tier: GuestRating['tier'];
  if (overallScore >= 9.0 || (guest.totalSpent >= 5000 && factors.damageHistoryScore >= 90)) {
    tier = 'VIP';
  } else if (overallScore >= 8.0) {
    tier = 'Excellent';
  } else if (overallScore >= 7.0) {
    tier = 'Good';
  } else if (overallScore >= 5.5) {
    tier = 'Average';
  } else if (overallScore >= 4.0) {
    tier = 'Caution';
  } else {
    tier = 'Restricted';
  }

  // Override tier based on critical factors
  if (guest.isBlacklisted) {
    tier = 'Restricted';
  } else if (factors.damageHistoryScore < 40) {
    tier = 'Caution'; // Major damage history
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (factors.spendingScore >= 90) {
    recommendations.push('High-value guest - consider VIP treatment');
  }
  if (factors.visitFrequencyScore >= 80) {
    recommendations.push('Loyal repeat guest - thank them for continued business');
  }
  if (factors.reviewBehaviorScore < 50) {
    recommendations.push('Consider asking for a review after their stay');
  }
  if (factors.damageHistoryScore < 70) {
    recommendations.push('Review damage history before confirming booking');
  }
  if (factors.communicationScore < 60) {
    recommendations.push('May need extra follow-up for check-in instructions');
  }
  if (tier === 'Caution') {
    recommendations.push('Require security deposit or additional verification');
  }
  if (tier === 'VIP') {
    recommendations.push('Offer early check-in or late checkout if available');
    recommendations.push('Consider welcome gift or amenity upgrade');
  }

  return {
    overallScore,
    tier,
    factors,
    recommendations,
    lastCalculated: new Date().toISOString(),
  };
}

// Get rating display color
export function getRatingColor(tier: GuestRating['tier']): string {
  switch (tier) {
    case 'VIP':
      return '#C4A777'; // Gold
    case 'Excellent':
      return '#22c55e'; // Green
    case 'Good':
      return '#3b82f6'; // Blue
    case 'Average':
      return '#6b7280'; // Gray
    case 'Caution':
      return '#f59e0b'; // Amber
    case 'Restricted':
      return '#ef4444'; // Red
  }
}

// Get tier badge text
export function getTierBadge(tier: GuestRating['tier']): { text: string; emoji: string } {
  switch (tier) {
    case 'VIP':
      return { text: 'VIP Guest', emoji: '👑' };
    case 'Excellent':
      return { text: 'Excellent', emoji: '⭐' };
    case 'Good':
      return { text: 'Good', emoji: '👍' };
    case 'Average':
      return { text: 'Average', emoji: '📊' };
    case 'Caution':
      return { text: 'Caution', emoji: '⚠️' };
    case 'Restricted':
      return { text: 'Restricted', emoji: '🚫' };
  }
}

// Format score for display
export function formatScore(score: number): string {
  return score.toFixed(1);
}

// Get factor label
export function getFactorLabel(factor: keyof GuestRatingFactors): string {
  const labels: Record<keyof GuestRatingFactors, string> = {
    spendingScore: 'Total Spending',
    visitFrequencyScore: 'Visit Frequency',
    reviewBehaviorScore: 'Review Behavior',
    damageHistoryScore: 'Damage History',
    communicationScore: 'Communication',
    ruleComplianceScore: 'Rule Compliance',
    paymentScore: 'Payment History',
  };
  return labels[factor];
}
