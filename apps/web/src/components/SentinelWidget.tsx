'use client';

/**
 * Chat Widget - Right at Home BnB (Steven Concierge)
 * Connects to Echo Chat API for AI-powered guest assistance
 * @author ECHO OMEGA PRIME | Authority 11.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, X, Send, Volume2, VolumeX, Loader2,
  Sparkles, Home, Calendar, Phone
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// AI Concierge API (local Next.js route with Groq/OpenAI)
const CHAT_API_URL = '/api/concierge';

function getUserId(): string {
  if (typeof window === 'undefined') return 'server';
  let visitorId = localStorage.getItem('rah_user_id');
  if (!visitorId) {
    visitorId = 'rah_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem('rah_user_id', visitorId);
  }
  return visitorId;
}

interface ChatWidgetProps {
  mode?: 'widget' | 'fullscreen';
  propertyId?: string;
}

export default function SentinelWidget({ mode = 'widget', propertyId }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(mode === 'fullscreen');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setUserId(getUserId());
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hey there! I'm Steven, your personal concierge for Right at Home BnB. Need restaurant tips, WiFi info, check-in details, or anything about your stay? Just ask!",
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, messages.length]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          sessionId: sessionId,
          guestType: 'guest',
          stream: false,
          voice: voiceEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "I'm having a little trouble right now. Can you try again?",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Play voice if enabled and audio returned
      if (voiceEnabled && (data.audio || data.audio_base64)) {
        try {
          setIsSpeaking(true);
          const audioData = data.audio || data.audio_base64;
          const audio = new Audio(`data:audio/mpeg;base64,${audioData}`);
          audioRef.current = audio;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
        } catch (e) {
          setIsSpeaking(false);
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry about that! I'm having a moment. Try again, or call Steven directly at (432) 559-1904.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, userId, sessionId, voiceEnabled]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: 'Properties', message: "Show me available properties" },
    { label: 'Check-In Info', message: "What are the check-in details?" },
    { label: 'Restaurant Tips', message: "Best restaurants nearby?" },
    { label: 'Contact Host', message: "How do I contact the host?" },
  ];

  if (mode === 'widget') {
    return (
      <>
        {/* Floating Button */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-[#500000] to-[#8B0000] text-white shadow-lg flex items-center justify-center ${isOpen ? 'hidden' : ''}`}
          style={{ boxShadow: '0 4px 20px rgba(80, 0, 0, 0.4)' }}
        >
          <div className="relative">
            <Home className="w-7 h-7" />
            <motion.div
              className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>
        </motion.button>

        {/* Pulse Effect */}
        {!isOpen && (
          <motion.div
            className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-[#500000]"
            animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
          />
        )}

        {/* Chat Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] bg-[#0a0505] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#500000]/30"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#500000] to-[#8B0000] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                      S
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Steven</h3>
                      <p className="text-white/80 text-sm flex items-center gap-1">
                        {isSpeaking ? <><Volume2 className="w-3 h-3" /> Speaking...</> : <><Sparkles className="w-3 h-3" /> Your Concierge</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors"
                      title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
                    >
                      {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0505]">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-[#500000] text-white rounded-br-sm'
                        : 'bg-[#1a0a0a] text-gray-200 border border-[#500000]/30 rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#1a0a0a] rounded-2xl px-4 py-3 border border-[#500000]/30 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#500000]" />
                      <span className="text-sm text-gray-400">Steven is typing...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions */}
              {messages.length <= 1 && (
                <div className="px-4 py-2 border-t border-[#500000]/30 bg-[#0a0505]">
                  <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => setInputValue(action.message)}
                        className="px-3 py-1.5 text-xs bg-[#500000]/20 text-[#ff6b6b] rounded-full hover:bg-[#500000]/40 border border-[#500000]/30 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t border-[#500000]/30 bg-[#0a0505]">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask Steven anything..."
                    className="flex-1 px-4 py-3 bg-[#1a0a0a] rounded-full text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#500000] border border-[#500000]/30"
                    disabled={isLoading}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="w-12 h-12 bg-gradient-to-br from-[#500000] to-[#8B0000] text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </motion.button>
                </div>
                <p className="text-center text-xs text-gray-500 mt-2">
                  Right at Home BnB Concierge
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Fullscreen mode
  return (
    <div className="w-full h-full flex flex-col bg-[#0a0505]">
      {/* ... fullscreen layout ... */}
    </div>
  );
}
