'use client';

/**
 * Steven AI - Intelligent Voice Concierge
 * ElevenLabs v3 Alpha with emotions, wake word detection, infinite memory
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, Volume2, VolumeX, X, Minimize2,
  Bot, User, Sparkles, ChevronDown, MessageCircle,
  Phone, Wrench, Leaf, Home, Calendar, Users
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotion?: string;
  hasAudio?: boolean;
}

interface GuestInfo {
  guestId: string;
  name?: string;
  conversationCount: number;
  lastSeen?: string;
  preferences: string[];
}

interface StevenAIProps {
  mode?: 'widget' | 'fullscreen';
  guestId?: string;
  propertyId?: string;
}

// Wake word patterns for client-side detection
const WAKE_PATTERNS = [
  /^(hey\s+)?steven/i,
  /^(hi\s+)?steven/i,
  /^(ok(ay)?\s+)?steven/i,
  /^(yo\s+)?steven/i,
  /^steve/i,
];

// Emotion indicators for UI
const EMOTION_COLORS: Record<string, string> = {
  neutral: 'text-gray-500',
  friendly: 'text-emerald-500',
  concerned: 'text-amber-500',
  excited: 'text-purple-500',
  professional: 'text-blue-500',
};

const EMOTION_ICONS: Record<string, string> = {
  neutral: '😊',
  friendly: '🤗',
  concerned: '🤔',
  excited: '🎉',
  professional: '👔',
};

export default function StevenAI({ mode = 'widget', guestId, propertyId }: StevenAIProps) {
  const [isOpen, setIsOpen] = useState(mode === 'fullscreen');
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hey there! I'm Steven, your personal concierge for Right at Home BnB. Need restaurant tips, WiFi info, or anything about your stay? Just ask!",
      timestamp: new Date(),
      emotion: 'friendly',
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentGuestId, setCurrentGuestId] = useState(guestId || `guest_${Date.now()}`);
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);
  const [wakeWordActive, setWakeWordActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');

        // Check for wake word
        const hasWakeWord = WAKE_PATTERNS.some(pattern => pattern.test(transcript.trim()));

        if (hasWakeWord || wakeWordActive) {
          setWakeWordActive(true);
          setInputValue(transcript);
        }

        // Final result
        if (event.results[event.results.length - 1].isFinal && (hasWakeWord || wakeWordActive)) {
          sendMessage(transcript);
          setWakeWordActive(false);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current?.start();
        }
      };
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [isListening, wakeWordActive]);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      setIsSpeaking(false);
      playNextInQueue();
    };
    audioRef.current.onerror = () => {
      setIsSpeaking(false);
      playNextInQueue();
    };

    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const playNextInQueue = () => {
    if (audioQueueRef.current.length > 0) {
      const nextAudio = audioQueueRef.current.shift();
      if (nextAudio && audioRef.current) {
        audioRef.current.src = nextAudio;
        audioRef.current.play();
        setIsSpeaking(true);
      }
    }
  };

  const playAudio = (audioData: string) => {
    if (!voiceEnabled) return;

    const audioUrl = `data:audio/mpeg;base64,${audioData}`;
    audioQueueRef.current.push(audioUrl);

    if (!isSpeaking) {
      playNextInQueue();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, isMinimized]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setWakeWordActive(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || inputValue;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/steven-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: messageText,
          guestId: currentGuestId,
          propertyId: propertyId,
          voiceEnabled: voiceEnabled,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        emotion: data.emotion,
        hasAudio: !!data.audio,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update guest info
      if (data.guestInfo) {
        setGuestInfo(data.guestInfo);
      }

      // Play audio if available
      if (data.audio) {
        playAudio(data.audio);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
        emotion: 'concerned',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopSpeaking = () => {
    audioRef.current?.pause();
    audioQueueRef.current = [];
    setIsSpeaking(false);
  };

  // Quick action buttons
  const quickActions = [
    { label: 'WiFi Info', query: 'What is the WiFi password?' },
    { label: 'Restaurants', query: 'Recommend some good restaurants nearby' },
    { label: 'Checkout', query: 'What time is checkout?' },
    { label: 'Emergency', query: 'Who do I contact for emergencies?' },
  ];

  const renderMessages = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F5F0]">
      {messages.map((msg) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
            {msg.role === 'assistant' && (
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 bg-gradient-to-br from-[#500000] to-[#722F37] rounded-full flex items-center justify-center">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs text-[#2D2D2D]/60">Steven</span>
                {msg.emotion && (
                  <span className={`text-xs ${EMOTION_COLORS[msg.emotion] || 'text-gray-500'}`}>
                    {EMOTION_ICONS[msg.emotion] || '😊'}
                  </span>
                )}
              </div>
            )}
            <div className={`p-3 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-[#500000] text-white rounded-br-md'
                : 'bg-white text-[#2D2D2D] rounded-bl-md shadow-sm border border-[#2D2D2D]/5'
            }`}>
              <p className="text-sm whitespace-pre-line leading-relaxed">
                {msg.content}
              </p>
              {msg.hasAudio && msg.role === 'assistant' && (
                <div className="flex items-center gap-1 mt-2 text-xs text-[#500000]/60">
                  <Volume2 className="w-3 h-3" />
                  <span>Voice response</span>
                </div>
              )}
            </div>
            <p className={`text-xs mt-1 ${
              msg.role === 'user' ? 'text-right text-[#2D2D2D]/40' : 'text-[#2D2D2D]/40'
            }`}>
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </motion.div>
      ))}

      {/* Typing Indicator */}
      {isTyping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
        >
          <div className="w-6 h-6 bg-gradient-to-br from-[#500000] to-[#722F37] rounded-full flex items-center justify-center">
            <Bot className="w-3 h-3 text-white" />
          </div>
          <div className="bg-white p-3 rounded-2xl rounded-bl-md shadow-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-[#500000]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-[#500000]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-[#500000]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </motion.div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );

  const renderInput = () => (
    <div className="p-3 bg-white border-t border-[#2D2D2D]/10">
      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="mb-3">
          <p className="text-xs text-[#2D2D2D]/50 mb-2">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(action.query)}
                className="px-3 py-1.5 bg-[#F5F5F0] hover:bg-[#500000]/10 rounded-full text-xs font-medium text-[#2D2D2D] transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Microphone Button */}
        <button
          onClick={toggleListening}
          className={`p-2.5 rounded-xl transition-all ${
            isListening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-[#F5F5F0] text-[#2D2D2D] hover:bg-[#500000]/10'
          }`}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isListening ? "Listening... say 'Hey Steven'" : "Ask Steven anything..."}
          className="flex-1 px-4 py-2.5 bg-[#F5F5F0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#2D2D2D]/40 focus:outline-none focus:ring-2 focus:ring-[#500000]/20"
        />

        {/* Voice Toggle */}
        <button
          onClick={() => {
            if (isSpeaking) stopSpeaking();
            else setVoiceEnabled(!voiceEnabled);
          }}
          className={`p-2.5 rounded-xl transition-colors ${
            isSpeaking
              ? 'bg-[#500000] text-white'
              : voiceEnabled
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-[#F5F5F0] text-[#2D2D2D]/40'
          }`}
          title={isSpeaking ? 'Stop speaking' : voiceEnabled ? 'Voice enabled' : 'Voice disabled'}
        >
          {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Send Button */}
        <button
          onClick={() => sendMessage()}
          disabled={!inputValue.trim()}
          className="p-2.5 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Wake Word Indicator */}
      {isListening && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[#2D2D2D]/60">
            {wakeWordActive ? 'Listening to you...' : "Say 'Hey Steven' to activate"}
          </span>
        </div>
      )}
    </div>
  );

  // Fullscreen mode
  if (mode === 'fullscreen') {
    return (
      <div className="h-full flex flex-col bg-white rounded-2xl border border-[#2D2D2D]/10 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#500000] to-[#722F37] p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Steven AI</h2>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Your Personal Concierge
              </div>
            </div>
          </div>
          {guestInfo && (
            <div className="mt-3 flex items-center gap-4 text-sm text-white/70">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {guestInfo.conversationCount} conversations
              </span>
              {guestInfo.preferences.length > 0 && (
                <span>Preferences: {guestInfo.preferences.slice(0, 3).join(', ')}</span>
              )}
            </div>
          )}
        </div>

        {/* Operations Context */}
        <div className="flex gap-2 p-3 bg-[#F5F5F0] border-b border-[#2D2D2D]/10 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-[#2D2D2D]">
            <Wrench className="w-3 h-3 text-[#500000]" />
            Maintenance
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-[#2D2D2D]">
            <Home className="w-3 h-3 text-[#500000]" />
            Cleaning
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-[#2D2D2D]">
            <Leaf className="w-3 h-3 text-[#500000]" />
            Lawn Care
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-[#2D2D2D]">
            <Calendar className="w-3 h-3 text-[#500000]" />
            Bookings
          </div>
        </div>

        {renderMessages()}
        {renderInput()}
      </div>
    );
  }

  // Widget mode (floating)
  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isOpen && !isMinimized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-20 right-0 w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-[#2D2D2D]/10 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#500000] to-[#722F37] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Steven AI</h3>
                      <div className="flex items-center gap-1.5 text-xs text-white/80">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        {isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Online'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsMinimized(true)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Minimize"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {renderMessages()}
              {renderInput()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimized State */}
        <AnimatePresence>
          {isOpen && isMinimized && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => setIsMinimized(false)}
              className="absolute bottom-20 right-0 flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg border border-[#2D2D2D]/10 hover:shadow-xl transition-shadow"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-[#500000] to-[#722F37] rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-[#2D2D2D]">Steven AI</span>
              {isSpeaking && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Volume2 className="w-3 h-3" />
                  Speaking
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-[#2D2D2D]/40" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Main Chat Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => isMinimized ? setIsMinimized(false) : setIsOpen(!isOpen)}
          className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            isOpen
              ? 'bg-[#2D2D2D] hover:bg-[#1a1a1a]'
              : 'bg-gradient-to-br from-[#500000] to-[#722F37] hover:shadow-xl hover:shadow-[#500000]/30'
          }`}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-6 h-6 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageCircle className="w-6 h-6 text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice Activity Indicator */}
          {isListening && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
            >
              <Mic className="w-3 h-3 text-white" />
            </motion.span>
          )}

          {/* Online Badge */}
          {!isOpen && !isListening && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"
            >
              <span className="w-2 h-2 bg-white rounded-full" />
            </motion.span>
          )}
        </motion.button>
      </div>
    </>
  );
}

// Web Speech API TypeScript declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
