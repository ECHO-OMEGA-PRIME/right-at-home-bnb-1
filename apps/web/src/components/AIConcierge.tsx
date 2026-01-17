'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Send, MapPin, Utensils, Wine, Calendar,
  Clock, Key, Wifi, Home, MessageCircle, Volume2, VolumeX,
  ChevronRight, Star, Navigation, Coffee, Music, Sun, Loader2
} from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  category?: string;
  isLoading?: boolean;
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
    { name: "Cancun Mexican Restaurant", type: "Mexican", rating: 4.4, price: "$", address: "4401 N Midland Dr", description: "Family-owned authentic Mexican" },
  ],
  bars: [
    { name: "The Blue Door", type: "Wine Bar", rating: 4.5, price: "$$$", address: "306 N Main St", description: "Elegant wine bar, perfect for date night" },
    { name: "Tall City Brewing Co", type: "Craft Brewery", rating: 4.6, price: "$$", address: "501 N Marienfeld St", description: "Local craft beers and live music" },
    { name: "Sip Patio Bar", type: "Cocktail Lounge", rating: 4.4, price: "$$", address: "309 N Main St", description: "Trendy downtown cocktails" },
  ],
  attractions: [
    { name: "Petroleum Museum", type: "Museum", rating: 4.5, price: "$", address: "1500 I-20 West", description: "History of the Permian Basin oil industry" },
    { name: "Museum of the Southwest", type: "Art & Science", rating: 4.6, price: "$", address: "1705 W Missouri Ave", description: "Art exhibits and planetarium shows" },
    { name: "I-20 Wildlife Preserve", type: "Nature", rating: 4.7, price: "Free", address: "2201 S Midland Dr", description: "Trails, bird watching, wetlands" },
  ]
};

const QuickAction = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-cream-200
               hover:border-maroon-800 hover:shadow-elegant transition-all group"
  >
    <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center
                    group-hover:bg-maroon-800 transition-colors">
      <Icon className="w-5 h-5 text-maroon-800 group-hover:text-white transition-colors" />
    </div>
    <span className="font-medium text-charcoal-800">{label}</span>
    <ChevronRight className="w-4 h-4 text-charcoal-400 ml-auto" />
  </button>
);

const PlaceCard = ({ place }: { place: LocalPlace }) => (
  <div className="p-4 bg-cream-50 rounded-xl border border-cream-200">
    <div className="flex items-start justify-between">
      <div>
        <h4 className="font-display font-semibold text-charcoal-800">{place.name}</h4>
        <p className="text-sm text-charcoal-500">{place.type} • {place.price}</p>
      </div>
      <div className="flex items-center gap-1 bg-gold-100 px-2 py-1 rounded-full">
        <Star className="w-3 h-3 text-gold-500 fill-gold-500" />
        <span className="text-sm font-medium text-gold-700">{place.rating}</span>
      </div>
    </div>
    <p className="text-sm text-charcoal-600 mt-2">{place.description}</p>
    <div className="flex items-center gap-2 mt-3 text-xs text-charcoal-500">
      <MapPin className="w-3 h-3" />
      {place.address}
    </div>
  </div>
);


export default function AIConcierge() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Welcome to Right at Home! I'm your personal concierge. How can I help you enjoy your stay in Midland?",
      timestamp: new Date(),
      category: 'greeting'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPlaces, setShowPlaces] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processQuery = (query: string): { response: string; category: string; places?: LocalPlace[] } => {
    const q = query.toLowerCase();

    if (q.includes('restaurant') || q.includes('eat') || q.includes('food') || q.includes('dinner')) {
      return {
        response: "Here are my top restaurant picks in Midland! I especially recommend Cork & Pig Tavern for their wine selection - perfect for a relaxed evening.",
        category: 'dining',
        places: MIDLAND_PLACES.restaurants
      };
    }

    if (q.includes('bar') || q.includes('wine') || q.includes('drink') || q.includes('cocktail')) {
      return {
        response: "Midland has some great spots for drinks! The Blue Door is our personal favorite - elegant atmosphere with an excellent wine list.",
        category: 'nightlife',
        places: MIDLAND_PLACES.bars
      };
    }

    if (q.includes('attraction') || q.includes('things to do') || q.includes('visit') || q.includes('museum')) {
      return {
        response: "There's plenty to explore in Midland! The Petroleum Museum tells the fascinating story of how oil shaped this region.",
        category: 'attractions',
        places: MIDLAND_PLACES.attractions
      };
    }

    if (q.includes('wifi') || q.includes('internet') || q.includes('password')) {
      return {
        response: "Your WiFi details:\n\n📶 Network: RightAtHome_Guest\n🔐 Password: Welcome2024\n\nThe router is located near the living room TV. Enjoy streaming!",
        category: 'property'
      };
    }

    if (q.includes('checkout') || q.includes('check out') || q.includes('leaving')) {
      return {
        response: "Checkout time is 11:00 AM. Before you go:\n\n✓ Leave keys on kitchen counter\n✓ Close all windows\n✓ Take out trash\n\nWant a late checkout? I can check availability for you!",
        category: 'checkout'
      };
    }

    if (q.includes('late checkout')) {
      return {
        response: "I'd be happy to request a late checkout for you! What time would you prefer? I'll check with Steven and get back to you shortly.",
        category: 'request'
      };
    }

    if (q.includes('directions') || q.includes('how to get') || q.includes('where')) {
      return {
        response: "I can help with directions! Your property address has been sent to your phone via Google Maps. Where would you like to go?",
        category: 'navigation'
      };
    }

    if (q.includes('thermostat') || q.includes('temperature') || q.includes('ac') || q.includes('heat')) {
      return {
        response: "The smart thermostat is located in the hallway. Current setting: 72°F. Would you like me to adjust the temperature for you?",
        category: 'property'
      };
    }

    if (q.includes('emergency') || q.includes('help') || q.includes('problem')) {
      return {
        response: "I'm here to help! For emergencies:\n\n🚨 Emergency: 911\n🏥 Medical Center Hospital: (432) 685-1111\n📞 Steven (Host): (432) 559-1904\n\nWhat's the issue? I'll make sure it gets resolved.",
        category: 'emergency'
      };
    }

    return {
      response: "I'd be happy to help! I can assist with:\n\n🍽️ Restaurant & bar recommendations\n🎭 Local attractions & events\n🗺️ Directions & maps\n🏠 Property info (WiFi, checkout, etc.)\n⏰ Late checkout requests\n\nWhat would you like to know?",
      category: 'general'
    };
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userQuery = inputValue.trim();
    const userMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: userQuery,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add loading message
    const loadingMessage: Message = {
      id: messages.length + 2,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          stream: false
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Remove loading message and add real response
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, {
          id: filtered.length + 1,
          role: 'assistant',
          content: data.response || data.message || "I'm here to help! What would you like to know?",
          timestamp: new Date(),
          category: data.category || detectCategory(userQuery)
        }];
      });

      // Show places panel if relevant category
      const category = data.category || detectCategory(userQuery);
      if (['dining', 'nightlife', 'attractions'].includes(category)) {
        setShowPlaces(category === 'dining' ? 'restaurants' : category === 'nightlife' ? 'bars' : 'attractions');
      }

    } catch (error: any) {
      if (error.name === 'AbortError') return;

      console.error('Concierge API error:', error);

      // Fallback to local processing if API fails
      const { response, category, places } = processQuery(userQuery);

      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, {
          id: filtered.length + 1,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          category
        }];
      });

      if (places) {
        setShowPlaces(category);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Detect category from query for local fallback
  const detectCategory = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('restaurant') || q.includes('eat') || q.includes('food') || q.includes('dinner')) return 'dining';
    if (q.includes('bar') || q.includes('wine') || q.includes('drink')) return 'nightlife';
    if (q.includes('attraction') || q.includes('museum') || q.includes('visit')) return 'attractions';
    if (q.includes('wifi') || q.includes('checkout') || q.includes('thermostat')) return 'property';
    return 'general';
  };

  const handleQuickAction = (action: string) => {
    setInputValue(action);
    setTimeout(() => sendMessage(), 100);
  };

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-charcoal-800 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-maroon-800 to-maroon-900 
                          rounded-xl flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          AI Concierge
        </h2>
        <p className="text-charcoal-500 mt-2">
          Your personal assistant for exploring Midland, TX
        </p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-cream-200 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-maroon-800 text-white rounded-br-md'
                    : 'bg-cream-100 text-charcoal-800 rounded-bl-md'
                }`}>
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-maroon-600" />
                      <span className="text-charcoal-500">Thinking...</span>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-line">{msg.content}</p>
                      <p className={`text-xs mt-2 ${
                        msg.role === 'user' ? 'text-maroon-200' : 'text-charcoal-400'
                      }`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-cream-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsListening(!isListening)}
                className={`p-3 rounded-xl transition-all ${
                  isListening 
                    ? 'bg-maroon-800 text-white animate-pulse' 
                    : 'bg-cream-100 text-charcoal-600 hover:bg-cream-200'
                }`}
              >
                {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask me anything about Midland..."
                className="flex-1 input-field"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions & Places */}
        <div className="w-80 space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <h3 className="font-display font-semibold text-charcoal-800 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <QuickAction 
                icon={Utensils} 
                label="Find Restaurants" 
                onClick={() => handleQuickAction("Where should I eat dinner tonight?")}
              />
              <QuickAction 
                icon={Wine} 
                label="Wine & Bars" 
                onClick={() => handleQuickAction("Recommend a nice wine bar")}
              />
              <QuickAction 
                icon={MapPin} 
                label="Things to Do" 
                onClick={() => handleQuickAction("What attractions should I visit?")}
              />
              <QuickAction 
                icon={Wifi} 
                label="WiFi Info" 
                onClick={() => handleQuickAction("What's the WiFi password?")}
              />
              <QuickAction 
                icon={Clock} 
                label="Late Checkout" 
                onClick={() => handleQuickAction("Can I get a late checkout?")}
              />
            </div>
          </div>

          {/* Featured Places */}
          {showPlaces && MIDLAND_PLACES[showPlaces as keyof typeof MIDLAND_PLACES] && (
            <div className="bg-white rounded-2xl border border-cream-200 p-4">
              <h3 className="font-display font-semibold text-charcoal-800 mb-4">
                {showPlaces === 'restaurants' && '🍽️ Top Restaurants'}
                {showPlaces === 'bars' && '🍷 Wine & Bars'}
                {showPlaces === 'attractions' && '🎭 Attractions'}
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {MIDLAND_PLACES[showPlaces as keyof typeof MIDLAND_PLACES].map((place, i) => (
                  <PlaceCard key={i} place={place} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
