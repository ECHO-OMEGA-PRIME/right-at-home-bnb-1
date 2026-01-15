'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Web Audio API Sound Engine - AAA+++ Quality
// Premium UI sound feedback system

interface SoundConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
  filterFrequency?: number;
  filterQ?: number;
}

// Predefined sound presets
const SOUND_PRESETS: Record<string, SoundConfig> = {
  // UI Sounds
  hover: {
    frequency: 800,
    duration: 0.08,
    type: 'sine',
    attack: 0.01,
    decay: 0.05,
    sustain: 0.3,
    release: 0.02,
    volume: 0.15,
    filterFrequency: 2000,
    filterQ: 1,
  },
  click: {
    frequency: 440,
    duration: 0.1,
    type: 'triangle',
    attack: 0.005,
    decay: 0.08,
    sustain: 0.2,
    release: 0.02,
    volume: 0.25,
    filterFrequency: 3000,
    filterQ: 2,
  },
  success: {
    frequency: 523.25, // C5
    duration: 0.3,
    type: 'sine',
    attack: 0.02,
    decay: 0.1,
    sustain: 0.5,
    release: 0.15,
    volume: 0.3,
    filterFrequency: 4000,
    filterQ: 1,
  },
  error: {
    frequency: 220,
    duration: 0.25,
    type: 'sawtooth',
    attack: 0.01,
    decay: 0.1,
    sustain: 0.3,
    release: 0.1,
    volume: 0.2,
    filterFrequency: 1500,
    filterQ: 3,
  },
  notification: {
    frequency: 659.25, // E5
    duration: 0.15,
    type: 'sine',
    attack: 0.01,
    decay: 0.05,
    sustain: 0.4,
    release: 0.08,
    volume: 0.25,
    filterFrequency: 3500,
    filterQ: 1,
  },
  // Navigation Sounds
  navOpen: {
    frequency: 349.23, // F4
    duration: 0.2,
    type: 'sine',
    attack: 0.02,
    decay: 0.1,
    sustain: 0.3,
    release: 0.08,
    volume: 0.2,
    filterFrequency: 2500,
    filterQ: 1.5,
  },
  navClose: {
    frequency: 261.63, // C4
    duration: 0.15,
    type: 'sine',
    attack: 0.01,
    decay: 0.08,
    sustain: 0.3,
    release: 0.06,
    volume: 0.2,
    filterFrequency: 2000,
    filterQ: 1.5,
  },
  // Premium Ambient Sounds
  ambient: {
    frequency: 110,
    duration: 2,
    type: 'sine',
    attack: 0.5,
    decay: 0.5,
    sustain: 0.7,
    release: 1,
    volume: 0.05,
    filterFrequency: 800,
    filterQ: 0.5,
  },
  // Booking/Transaction Sounds
  bookingConfirm: {
    frequency: 392, // G4
    duration: 0.4,
    type: 'sine',
    attack: 0.02,
    decay: 0.15,
    sustain: 0.5,
    release: 0.2,
    volume: 0.35,
    filterFrequency: 4000,
    filterQ: 1,
  },
  // Card Hover 3D Effect
  cardHover: {
    frequency: 600,
    duration: 0.06,
    type: 'sine',
    attack: 0.005,
    decay: 0.03,
    sustain: 0.2,
    release: 0.02,
    volume: 0.1,
    filterFrequency: 1800,
    filterQ: 2,
  },
};

export interface SoundEngine {
  playSound: (preset: keyof typeof SOUND_PRESETS) => void;
  playChord: (frequencies: number[], duration?: number) => void;
  playSequence: (presets: (keyof typeof SOUND_PRESETS)[], interval?: number) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  volume: number;
  isInitialized: boolean;
}

export function useSoundEngine(): SoundEngine {
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Audio Context on first user interaction
  const initializeAudio = useCallback(() => {
    if (audioContextRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      // Master gain node for global volume control
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.gain.value = volume;
      masterGainRef.current.connect(audioContextRef.current.destination);

      setIsInitialized(true);
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }, [volume]);

  // Resume audio context if suspended
  const resumeAudio = useCallback(async () => {
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  // Initialize on first click/touch
  useEffect(() => {
    const handleInteraction = () => {
      initializeAudio();
      resumeAudio();
    };

    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [initializeAudio, resumeAudio]);

  // Play a single sound with envelope and filter
  const playSound = useCallback((preset: keyof typeof SOUND_PRESETS) => {
    if (!audioContextRef.current || !masterGainRef.current || isMuted) return;

    const config = SOUND_PRESETS[preset];
    if (!config) return;

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    // Create oscillator
    const oscillator = ctx.createOscillator();
    oscillator.type = config.type;
    oscillator.frequency.value = config.frequency;

    // Create gain for envelope
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    // Create filter for richer sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = config.filterFrequency || 2000;
    filter.Q.value = config.filterQ || 1;

    // Connect nodes: oscillator -> filter -> gain -> master
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGainRef.current);

    // ADSR Envelope
    const peakVolume = config.volume * volume;
    const sustainVolume = peakVolume * config.sustain;
    const attackEnd = now + config.attack;
    const decayEnd = attackEnd + config.decay;
    const sustainEnd = now + config.duration - config.release;
    const releaseEnd = now + config.duration;

    // Attack
    gainNode.gain.linearRampToValueAtTime(peakVolume, attackEnd);
    // Decay to sustain
    gainNode.gain.linearRampToValueAtTime(sustainVolume, decayEnd);
    // Sustain (hold)
    gainNode.gain.setValueAtTime(sustainVolume, sustainEnd);
    // Release
    gainNode.gain.linearRampToValueAtTime(0, releaseEnd);

    // Start and stop
    oscillator.start(now);
    oscillator.stop(releaseEnd + 0.01);

    // Cleanup
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
      filter.disconnect();
    };
  }, [isMuted, volume]);

  // Play a chord (multiple frequencies simultaneously)
  const playChord = useCallback((frequencies: number[], duration = 0.3) => {
    if (!audioContextRef.current || !masterGainRef.current || isMuted) return;

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;

      oscillator.connect(gainNode);
      gainNode.connect(masterGainRef.current!);

      // Slight delay for arpeggio effect
      const startDelay = index * 0.02;
      const peakVolume = 0.15 * volume;

      gainNode.gain.linearRampToValueAtTime(peakVolume, now + startDelay + 0.02);
      gainNode.gain.linearRampToValueAtTime(peakVolume * 0.7, now + startDelay + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, now + startDelay + duration);

      oscillator.start(now + startDelay);
      oscillator.stop(now + startDelay + duration + 0.01);
    });
  }, [isMuted, volume]);

  // Play a sequence of sounds
  const playSequence = useCallback((
    presets: (keyof typeof SOUND_PRESETS)[],
    interval = 0.15
  ) => {
    presets.forEach((preset, index) => {
      setTimeout(() => playSound(preset), index * interval * 1000);
    });
  }, [playSound]);

  // Mute control
  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = muted ? 0 : volume;
    }
  }, [volume]);

  // Volume control
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    if (masterGainRef.current && !isMuted) {
      masterGainRef.current.gain.value = clampedVolume;
    }
  }, [isMuted]);

  return {
    playSound,
    playChord,
    playSequence,
    setMuted,
    setVolume,
    isMuted,
    volume,
    isInitialized,
  };
}

// Success chord frequencies (C major)
export const SUCCESS_CHORD = [523.25, 659.25, 783.99]; // C5, E5, G5

// Error chord frequencies (diminished)
export const ERROR_CHORD = [493.88, 587.33, 698.46]; // B4, D5, F5

// Notification chord frequencies
export const NOTIFICATION_CHORD = [440, 554.37, 659.25]; // A4, C#5, E5

export default useSoundEngine;
