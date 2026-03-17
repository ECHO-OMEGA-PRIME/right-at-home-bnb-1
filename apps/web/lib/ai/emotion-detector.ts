/**
 * Right at Home BnB - Guest Emotion Detector
 * Analyzes guest messages to detect emotional state using keyword/pattern matching.
 * Used to prioritize urgent responses, flag unhappy guests, and personalize interactions.
 * No external API calls — runs entirely on keyword matching and scoring.
 */

// ============================================
// TYPES
// ============================================

export type EmotionLabel =
  | 'happy'
  | 'grateful'
  | 'excited'
  | 'neutral'
  | 'confused'
  | 'frustrated'
  | 'angry'
  | 'anxious'
  | 'disappointed'
  | 'urgent';

export interface EmotionResult {
  /** Primary detected emotion */
  primary: EmotionLabel;
  /** Confidence score 0-1 */
  confidence: number;
  /** Sentiment polarity: -1 (very negative) to +1 (very positive) */
  sentiment: number;
  /** Whether this message needs priority handling */
  needsEscalation: boolean;
  /** All detected emotions with scores */
  scores: Record<EmotionLabel, number>;
  /** Specific trigger words/phrases found */
  triggers: string[];
}

// ============================================
// EMOTION LEXICON
// ============================================

interface EmotionEntry {
  words: string[];
  phrases: RegExp[];
  weight: number;
}

const EMOTION_LEXICON: Record<EmotionLabel, EmotionEntry> = {
  happy: {
    words: ['love', 'amazing', 'wonderful', 'great', 'awesome', 'perfect', 'beautiful', 'fantastic', 'excellent', 'lovely', 'delightful', 'pleased', 'enjoy', 'enjoying', 'enjoyed', 'happy', 'glad', 'thrilled', 'impressed', 'cozy', 'comfortable', 'clean', 'spotless', 'gorgeous'],
    phrases: [/so\s+nice/i, /really\s+(love|like|enjoy)/i, /had\s+a\s+(great|wonderful|amazing)/i, /best\s+(stay|place|experience)/i, /will\s+(definitely|for\s+sure)\s+(come|be)\s+back/i, /exceeded\s+(my|our)\s+expectations/i, /can't\s+say\s+enough/i, /highly\s+recommend/i],
    weight: 1.0,
  },
  grateful: {
    words: ['thank', 'thanks', 'appreciate', 'grateful', 'thankful', 'kind', 'thoughtful', 'generous', 'helpful', 'accommodating'],
    phrases: [/thank\s+(you|u)\s+(so\s+much|very\s+much)/i, /really\s+appreciate/i, /means\s+a\s+lot/i, /above\s+and\s+beyond/i, /so\s+kind\s+of\s+you/i, /thanks\s+for\s+(everything|all)/i],
    weight: 0.9,
  },
  excited: {
    words: ['excited', 'can\'t wait', 'looking forward', 'pumped', 'stoked', 'thrilled', 'eager'],
    phrases: [/can't\s+wait/i, /looking\s+forward/i, /so\s+excited/i, /counting\s+(down|the\s+days)/i, /first\s+time\s+(in|visiting)/i],
    weight: 0.8,
  },
  neutral: {
    words: ['ok', 'okay', 'fine', 'sure', 'alright', 'sounds good', 'got it', 'understood', 'noted'],
    phrases: [/sounds?\s+good/i, /that\s+works/i, /no\s+problem/i, /will\s+do/i, /got\s+it/i],
    weight: 0.3,
  },
  confused: {
    words: ['confused', 'unclear', 'don\'t understand', 'lost', 'where', 'how', 'which', 'what'],
    phrases: [/i\s+don't\s+(understand|get\s+it)/i, /not\s+sure\s+(how|where|what|which)/i, /can\s+you\s+(explain|clarify)/i, /where\s+(do|should|can)\s+i/i, /how\s+(do|does|should|can)\s+i/i, /i'm\s+(lost|confused)/i, /which\s+one/i, /what\s+do\s+you\s+mean/i],
    weight: 0.5,
  },
  frustrated: {
    words: ['frustrated', 'annoying', 'annoyed', 'inconvenient', 'hassle', 'ridiculous', 'unacceptable', 'disappointing', 'issue', 'problem', 'trouble', 'difficult', 'struggling', 'still', 'again'],
    phrases: [/this\s+is\s+(frustrating|annoying|ridiculous)/i, /been\s+trying/i, /still\s+(not|doesn't|won't|can't)/i, /for\s+the\s+(second|third|fourth)\s+time/i, /already\s+(told|asked|mentioned)/i, /how\s+many\s+times/i, /not\s+what\s+i\s+(expected|paid\s+for)/i, /waste\s+of/i],
    weight: 0.9,
  },
  angry: {
    words: ['angry', 'furious', 'livid', 'outraged', 'terrible', 'horrible', 'worst', 'disgusting', 'filthy', 'scam', 'lied', 'lying', 'cheated', 'ripped off', 'lawsuit', 'lawyer', 'refund', 'complaint', 'report'],
    phrases: [/this\s+is\s+(unacceptable|outrageous|the\s+worst)/i, /i\s+want\s+(a\s+full\s+)?refund/i, /i('m|\s+am)\s+(going\s+to|gonna)\s+(report|sue|contact|leave\s+a\s+review)/i, /never\s+(again|coming\s+back|staying)/i, /rip[\s-]*off/i, /false\s+advertising/i, /you\s+(lied|promised)/i, /i\s+demand/i, /speak\s+to\s+(a\s+)?(manager|supervisor|owner)/i],
    weight: 1.2,
  },
  anxious: {
    words: ['worried', 'concerned', 'nervous', 'anxious', 'scared', 'afraid', 'unsafe', 'security', 'alarm', 'noise', 'suspicious', 'uncomfortable'],
    phrases: [/i('m|\s+am)\s+(worried|concerned|nervous|scared)/i, /is\s+(it|this)\s+(safe|secure|normal)/i, /should\s+i\s+be\s+(worried|concerned)/i, /i\s+heard\s+(a\s+)?(noise|sound)/i, /someone\s+(is|was)\s+(at|near|outside)/i, /doesn't\s+(feel|seem)\s+safe/i, /lock\s+(not|doesn't|won't)/i],
    weight: 0.8,
  },
  disappointed: {
    words: ['disappointed', 'letdown', 'expected', 'hoped', 'wished', 'misleading', 'inaccurate', 'outdated', 'different', 'smaller', 'worse'],
    phrases: [/not\s+what\s+(i|we)\s+expected/i, /doesn't\s+(match|look\s+like)\s+the\s+(photos?|listing|description)/i, /i\s+(expected|hoped|thought)\s+(it\s+would|there\s+would)/i, /kind\s+of\s+(a\s+)?letdown/i, /missing\s+(the|a)/i, /listed\s+as/i, /photos?\s+(are|were)\s+misleading/i],
    weight: 0.7,
  },
  urgent: {
    words: ['emergency', 'urgent', 'asap', 'immediately', 'right now', 'help', 'stuck', 'locked out', 'can\'t get in', 'no water', 'no power', 'flooding', 'fire'],
    phrases: [/locked\s+out/i, /can't\s+get\s+in/i, /no\s+(hot\s+)?water/i, /no\s+(power|electricity)/i, /pipe\s+(burst|broke|leaking)/i, /smell\s+gas/i, /fire/i, /flooding/i, /i\s+need\s+help\s+(now|right\s+now|immediately|asap)/i, /please\s+help/i, /it's\s+(an?\s+)?emergency/i],
    weight: 1.5,
  },
};

// ============================================
// DETECTION ENGINE
// ============================================

/**
 * Detect the emotional state of a guest message.
 * Uses keyword matching and phrase detection with weighted scoring.
 *
 * @param message - The guest's message text
 * @returns Emotion analysis result
 */
export function detectEmotion(message: string): EmotionResult {
  const normalizedMessage = message.toLowerCase().trim();
  const words = normalizedMessage.split(/\s+/);
  const triggers: string[] = [];

  // Score each emotion
  const rawScores: Record<EmotionLabel, number> = {
    happy: 0,
    grateful: 0,
    excited: 0,
    neutral: 0,
    confused: 0,
    frustrated: 0,
    angry: 0,
    anxious: 0,
    disappointed: 0,
    urgent: 0,
  };

  for (const [emotion, lexicon] of Object.entries(EMOTION_LEXICON) as Array<[EmotionLabel, EmotionEntry]>) {
    // Word matching
    for (const keyword of lexicon.words) {
      const keywordLower = keyword.toLowerCase();
      if (words.some((w) => w.includes(keywordLower)) || normalizedMessage.includes(keywordLower)) {
        rawScores[emotion] += lexicon.weight;
        triggers.push(keyword);
      }
    }

    // Phrase matching (weighted higher — phrases are more specific)
    for (const pattern of lexicon.phrases) {
      if (pattern.test(normalizedMessage)) {
        rawScores[emotion] += lexicon.weight * 1.5;
        triggers.push(pattern.source);
      }
    }
  }

  // Exclamation marks amplify detected emotions
  const exclamationCount = (message.match(/!/g) || []).length;
  if (exclamationCount > 0) {
    for (const emotion of Object.keys(rawScores) as EmotionLabel[]) {
      if (rawScores[emotion] > 0) {
        rawScores[emotion] *= 1 + exclamationCount * 0.1;
      }
    }
  }

  // ALL CAPS amplifies negative emotions
  const capsRatio = message.replace(/[^A-Za-z]/g, '').length > 0
    ? (message.replace(/[^A-Z]/g, '').length / message.replace(/[^A-Za-z]/g, '').length)
    : 0;
  if (capsRatio > 0.5 && message.length > 10) {
    rawScores.angry *= 1.3;
    rawScores.frustrated *= 1.2;
    rawScores.urgent *= 1.2;
  }

  // If no emotion detected, default to neutral
  const totalScore = Object.values(rawScores).reduce((sum, s) => sum + s, 0);
  if (totalScore === 0) {
    rawScores.neutral = 1.0;
  }

  // Normalize scores to 0-1 range
  const maxScore = Math.max(...Object.values(rawScores));
  const scores: Record<EmotionLabel, number> = {} as Record<EmotionLabel, number>;
  for (const [emotion, score] of Object.entries(rawScores) as Array<[EmotionLabel, number]>) {
    scores[emotion] = maxScore > 0 ? Math.round((score / maxScore) * 100) / 100 : 0;
  }

  // Find the primary emotion (highest score)
  let primary: EmotionLabel = 'neutral';
  let highestScore = 0;
  for (const [emotion, score] of Object.entries(scores) as Array<[EmotionLabel, number]>) {
    if (score > highestScore) {
      highestScore = score;
      primary = emotion;
    }
  }

  // Calculate sentiment polarity (-1 to +1)
  const positiveScore = rawScores.happy + rawScores.grateful + rawScores.excited;
  const negativeScore = rawScores.frustrated + rawScores.angry + rawScores.anxious + rawScores.disappointed;
  const sentimentRaw = positiveScore - negativeScore;
  const sentimentMax = Math.max(positiveScore + negativeScore, 1);
  const sentiment = Math.round((sentimentRaw / sentimentMax) * 100) / 100;

  // Determine if escalation is needed
  const needsEscalation =
    primary === 'angry' ||
    primary === 'urgent' ||
    (primary === 'frustrated' && rawScores.frustrated > 2.0) ||
    (primary === 'anxious' && rawScores.anxious > 1.5);

  // Confidence based on how dominant the primary emotion is vs. others
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const dominance = sortedScores[0] > 0 && sortedScores.length > 1
    ? (sortedScores[0] - (sortedScores[1] || 0)) / sortedScores[0]
    : 0;
  const confidence = Math.round(Math.min(1, 0.5 + dominance * 0.5) * 100) / 100;

  return {
    primary,
    confidence,
    sentiment,
    needsEscalation,
    scores,
    triggers: [...new Set(triggers)], // deduplicate
  };
}

/**
 * Get a human-readable description of the emotion for logging/display.
 */
export function describeEmotion(result: EmotionResult): string {
  const sentimentLabel = result.sentiment > 0.3 ? 'positive'
    : result.sentiment < -0.3 ? 'negative'
    : 'neutral';

  return `${result.primary} (${Math.round(result.confidence * 100)}% confidence, ${sentimentLabel} sentiment${result.needsEscalation ? ', ESCALATION NEEDED' : ''})`;
}

/**
 * Determine the response priority based on detected emotion.
 * Returns a priority level from 1 (highest) to 5 (lowest).
 */
export function getResponsePriority(result: EmotionResult): number {
  if (result.primary === 'urgent') return 1;
  if (result.primary === 'angry') return 1;
  if (result.primary === 'anxious' && result.needsEscalation) return 2;
  if (result.primary === 'frustrated') return 2;
  if (result.primary === 'disappointed') return 3;
  if (result.primary === 'confused') return 3;
  if (result.primary === 'neutral') return 4;
  if (result.primary === 'happy' || result.primary === 'grateful' || result.primary === 'excited') return 5;
  return 4;
}
