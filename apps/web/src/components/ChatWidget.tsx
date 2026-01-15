'use client';

/**
 * Right at Home BnB - Floating Chat Widget
 * AI Concierge chat box with minimize/expand functionality
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, X, Minimize2, Send, Mic, MicOff,
  MapPin, Utensils, Wine, Wifi, Clock, Star,
  ChevronDown, Sparkles, Bot, User
} from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface LocalPlace {
  name: string;
  type: string;
  rating: number;
  price: string;
  address: string;
  description?: string;
}

const MIDLAND_PLACES: Record<string, LocalPlace[]> = {
  restaurants: [
    { name: "Venezia Italian Restaurant", type: "Italian", rating: 4.5, price: "$$", address: "2101 W Wadley Ave", description: "Authentic Italian cuisine with wine selection" },
    { name: "The Garlic Press", type: "American Fine Dining", rating: 4.7, price: "$$$", address: "2200 W Texas Ave", description: "Upscale American with local ingredients" },
    { name: "Cork & Pig Tavern", type: "American/Wine Bar", rating: 4.6, price: "$$", address: "3301 N Big Spring St", description: "Craft cocktails and elevated pub fare" },
  ],
  bars: [
    { name: "The Blue Door", type: "Wine Bar", rating: 4.5, price: "$$$", address: "306 N Main St", description: "Elegant wine bar, perfect for date night" },
    { name: "Tall City Brewing Co", type: "Craft Brewery", rating: 4.6, price: "$$", address: "501 N Marienfeld St", description: "Local craft beers and live music" },
  ],
  attractions: [
    { name: "Petroleum Museum", type: "Museum", rating: 4.5, price: "$", address: "1500 I-20 West", description: "History of the Permian Basin oil industry" },
    { name: "Museum of the Southwest", type: "Art & Science", rating: 4.6, price: "$", address: "1705 W Missouri Ave", description: "Art exhibits and planetarium shows" },
  ]
};

const QUICK_REPLIES = [
  { icon: Wifi, label: "WiFi Info", query: "What's the WiFi password?" },
  { icon: Utensils, label: "Restaurants", query: "Recommend restaurants nearby" },
  { icon: Wine, label: "Bars", query: "Where can I get drinks?" },
  { icon: Clock, label: "Checkout", query: "What time is checkout?" },
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Hi! I'm your Right at Home AI concierge. How can I help you enjoy your stay in Midland? 🏠",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, isMinimized]);

  const processQuery = (query: string): { response: string; places?: LocalPlace[] } => {
    const q = query.toLowerCase();

    if (q.includes('restaurant') || q.includes('eat') || q.includes('food') || q.includes('dinner') || q.includes('lunch')) {
      return {
        response: "Here are my top restaurant picks! I especially recommend Cork & Pig Tavern for their amazing atmosphere. 🍽️",
        places: MIDLAND_PLACES.restaurants
      };
    }

    if (q.includes('bar') || q.includes('wine') || q.includes('drink') || q.includes('cocktail') || q.includes('beer')) {
      return {
        response: "Great spots for drinks! The Blue Door has an excellent wine selection. 🍷",
        places: MIDLAND_PLACES.bars
      };
    }

    if (q.includes('attraction') || q.includes('things to do') || q.includes('visit') || q.includes('museum') || q.includes('fun')) {
      return {
        response: "There's plenty to explore! The Petroleum Museum tells a fascinating story about the region. 🎭",
        places: MIDLAND_PLACES.attractions
      };
    }

    if (q.includes('wifi') || q.includes('internet') || q.includes('password')) {
      return {
        response: "📶 **WiFi Details**\n\nNetwork: RightAtHome_Guest\nPassword: Welcome2024\n\nThe router is near the living room TV. Enjoy streaming!"
      };
    }

    if (q.includes('checkout') || q.includes('check out') || q.includes('leaving')) {
      return {
        response: "⏰ **Checkout Info**\n\nCheckout time: 11:00 AM\n\nBefore you go:\n✓ Leave keys on kitchen counter\n✓ Close all windows\n✓ Take out trash\n\nNeed a late checkout? Just ask!"
      };
    }

    if (q.includes('late checkout')) {
      return {
        response: "I'd be happy to request a late checkout! What time would you prefer? I'll check with Steven and get back to you. 😊"
      };
    }

    if (q.includes('checkin') || q.includes('check in') || q.includes('check-in') || q.includes('arriving')) {
      return {
        response: "🔑 **Check-in Info**\n\nCheck-in time: 3:00 PM\n\nYour door code will be sent via text. The lockbox is on the front door. Welcome home!"
      };
    }

    if (q.includes('emergency') || q.includes('help') || q.includes('problem') || q.includes('issue')) {
      return {
        response: "🚨 **Emergency Contacts**\n\n• Emergency: 911\n• Medical Center: (432) 685-1111\n• Steven (Host): (432) 559-1904\n\nWhat's the issue? I'll make sure it gets resolved!"
      };
    }

    if (q.includes('pool') || q.includes('hot tub') || q.includes('jacuzzi')) {
      return {
        response: "🏊 **Pool/Hot Tub Info**\n\nPool hours: 8 AM - 10 PM\nTowels are in the hall closet\n\nPlease shower before entering and no glass near the pool area!"
      };
    }

    if (q.includes('parking') || q.includes('car') || q.includes('garage')) {
      return {
        response: "🚗 **Parking**\n\nFree parking in the driveway. Street parking is also available. The garage is not accessible to guests."
      };
    }

    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
      return {
        response: "Hello! 👋 Welcome to Right at Home! I'm here to help with anything you need - restaurants, WiFi, checkout info, or local tips. What can I help you with?"
      };
    }

    if (q.includes('thank')) {
      return {
        response: "You're welcome! 😊 Enjoy your stay! Let me know if you need anything else."
      };
    }

    return {
      response: "I can help with:\n\n🍽️ Restaurant recommendations\n🍷 Bars & nightlife\n🎭 Local attractions\n📶 WiFi & property info\n⏰ Check-in/out details\n📞 Emergency contacts\n\nWhat would you like to know?"
    };
  };

  const sendMessage = (text?: string) => {
    const messageText = text || inputValue;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI thinking
    setTimeout(() => {
      const { response, places } = processQuery(messageText);

      let fullResponse = response;
      if (places) {
        fullResponse += '\n\n' + places.map(p =>
          `**${p.name}** - ${p.type}\n⭐ ${p.rating} | ${p.price} | 📍 ${p.address}`
        ).join('\n\n');
      }

      const assistantMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 800 + Math.random() * 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const minimizeChat = () => {
    setIsMinimized(true);
  };

  const closeChat = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Chat Widget Container */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isOpen && !isMinimized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-20 right-0 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-[#2D2D2D]/10 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#500000] to-[#722F37] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">AI Concierge</h3>
                      <div className="flex items-center gap-1.5 text-xs text-white/80">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        Online
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={minimizeChat}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Minimize"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={closeChat}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
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
                          <div className="w-6 h-6 bg-[#500000] rounded-full flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs text-[#2D2D2D]/60">AI Concierge</span>
                        </div>
                      )}
                      <div className={`p-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-[#500000] text-white rounded-br-md'
                          : 'bg-white text-[#2D2D2D] rounded-bl-md shadow-sm border border-[#2D2D2D]/5'
                      }`}>
                        <p className="text-sm whitespace-pre-line leading-relaxed">
                          {msg.content.split('**').map((part, i) =>
                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                          )}
                        </p>
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
                    <div className="w-6 h-6 bg-[#500000] rounded-full flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-white" />
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

              {/* Quick Replies */}
              {messages.length <= 2 && (
                <div className="px-4 py-2 bg-white border-t border-[#2D2D2D]/5">
                  <p className="text-xs text-[#2D2D2D]/50 mb-2">Quick questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_REPLIES.map((reply, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(reply.query)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F0] hover:bg-[#500000]/10 rounded-full text-xs font-medium text-[#2D2D2D] transition-colors"
                      >
                        <reply.icon className="w-3 h-3 text-[#500000]" />
                        {reply.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-3 bg-white border-t border-[#2D2D2D]/10">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything..."
                    className="flex-1 px-4 py-2.5 bg-[#F5F5F0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#2D2D2D]/40 focus:outline-none focus:ring-2 focus:ring-[#500000]/20"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!inputValue.trim()}
                    className="p-2.5 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
              <div className="w-8 h-8 bg-[#500000] rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-[#2D2D2D]">AI Concierge</span>
              <ChevronDown className="w-4 h-4 text-[#2D2D2D]/40" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Main Chat Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleChat}
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

          {/* Notification Badge */}
          {!isOpen && (
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
