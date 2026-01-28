/**
 * Echo Prime AI Service for Right at Home BnB
 * Uses "Steven" personality - friendly, helpful vacation rental host
 *
 * Service URL: https://audio-intel-249995513427.us-central1.run.app
 */

const ECHO_PRIME_URL = 'https://audio-intel-249995513427.us-central1.run.app';

export type Personality = 'steven' | 'echo' | 'prometheus' | 'gs343';

export interface EmotionData {
  primary_emotion: string;
  valence: number;
  arousal: number;
  intensity: number;
  mood: string;
  is_urgent: boolean;
}

export interface ChatResponse {
  response: string;
  personality: string;
  emotion: EmotionData;
  model: string;
  audio_base64?: string;
}

export interface TTSResponse {
  audio_base64: string;
  format: string;
  emotion_detected?: string;
}

/**
 * Chat with Steven AI (Right at Home's virtual concierge)
 */
export async function chatWithSteven(
  message: string,
  options?: {
    ttsEnabled?: boolean;
    systemPrompt?: string;
  }
): Promise<ChatResponse> {
  const response = await fetch(`${ECHO_PRIME_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      personality: 'steven',
      provider: 'groq',
      detect_emotion: true,
      tts_enabled: options?.ttsEnabled ?? false,
      tts_provider: 'elevenlabs',
      memory_enabled: true,
      system_prompt: options?.systemPrompt || `You are Steven, the friendly AI concierge for Right at Home vacation rentals in Midland, Texas.
You help guests with:
- Local restaurant and entertainment recommendations
- Property information (WiFi, checkout times, house rules)
- Directions and transportation
- Special requests (late checkout, early check-in)
- Emergency contacts and support

Be warm, helpful, and personable. Use relevant emojis occasionally.
Keep responses concise but informative. Always offer to help with more.`
    })
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Text-to-Speech with Steven's voice
 */
export async function speakAsSteven(text: string): Promise<Blob> {
  const response = await fetch(`${ECHO_PRIME_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      provider: 'elevenlabs',
      personality: 'steven',
      detect_emotion: true
    })
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }

  return response.blob();
}

/**
 * Text-to-Speech returning base64 (better for React Native)
 */
export async function speakAsStevenBase64(text: string): Promise<TTSResponse> {
  const response = await fetch(`${ECHO_PRIME_URL}/tts/base64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      provider: 'elevenlabs',
      personality: 'steven',
      detect_emotion: true
    })
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Chat with voice response (combined)
 */
export async function chatWithVoice(message: string): Promise<ChatResponse> {
  return chatWithSteven(message, { ttsEnabled: true });
}

/**
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ECHO_PRIME_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Analyze emotion in text
 */
export async function analyzeEmotion(text: string): Promise<EmotionData> {
  const response = await fetch(`${ECHO_PRIME_URL}/emotion/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error(`Emotion analysis failed: ${response.status}`);
  }

  const data = await response.json();
  return data.emotion;
}

export default {
  chatWithSteven,
  speakAsSteven,
  speakAsStevenBase64,
  chatWithVoice,
  checkHealth,
  analyzeEmotion
};
