'use client';

/**
 * Right at Home BnB - AI Concierge
 * GPT-4 powered guest assistant with voice, local recommendations, rich cards
 * Serves BOTH work crews AND regular guests
 * @author ECHO OMEGA PRIME - ENHANCED
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import {
  MessageSquare, Send, Mic, MicOff, Volume2, VolumeX,
  MapPin, Utensils, Wine, Star, Clock, Phone, Info,
  Sparkles, Bot, User, ChevronRight, Loader2, X,
  Wrench, Home, Heart, Briefcase, Users, Navigation,
  Coffee, ShoppingBag, Fuel, Building2, DollarSign,
  ThumbsUp, ThumbsDown, Copy, Share2, ExternalLink,
  Zap, Lightbulb, HelpCircle, Calendar, Wifi, Key,
  Droplets, Thermometer, Car, Map, Globe, Search,
  ChevronDown, ChevronUp, MoreHorizontal, Bookmark,
  MessageCircle, RefreshCw, Settings, Bell
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  category?: string;
  recommendations?: LocalBusiness[];
  suggestedReplies?: string[];
  feedback?: 'positive' | 'negative' | null;
  isTyping?: boolean;
}

interface LocalBusiness {
  id: string;
  name: string;
  category: BusinessCategory;
  address: string;
  phone?: string;
  rating: number;
  reviewCount: number;
  priceLevel: 1 | 2 | 3 | 4;
  distance: string;
  hours: {
    open: string;
    close: string;
    isOpen: boolean;
  };
  features: string[];
  image?: string;
  website?: string;
  description: string;
}

type BusinessCategory =
  | 'restaurant' | 'bar' | 'coffee' | 'grocery' | 'hardware'
  | 'gas' | 'laundromat' | 'medical' | 'attraction' | 'shopping';

type GuestType = 'work_crew' | 'family' | 'couple' | 'business' | 'general';

interface ConversationContext {
  guestType: GuestType;
  propertyId?: string;
  checkInDate?: Date;
  checkOutDate?: Date;
  interests: string[];
  previousTopics: string[];
}

// ============================================================================
// MOCK DATA - LOCAL BUSINESSES
// ============================================================================

const localBusinesses: LocalBusiness[] = [
  // Restaurants
  {
    id: 'rest1',
    name: 'The Garlic Press',
    category: 'restaurant',
    address: '2314 W Wadley Ave',
    phone: '(432) 684-5344',
    rating: 4.7,
    reviewCount: 342,
    priceLevel: 3,
    distance: '2.1 mi',
    hours: { open: '11:00 AM', close: '10:00 PM', isOpen: true },
    features: ['Fine Dining', 'Wine Selection', 'Romantic'],
    description: 'Upscale Italian with excellent wine list. Perfect for date night.',
  },
  {
    id: 'rest2',
    name: 'Wall Street Bar & Grill',
    category: 'restaurant',
    address: '115 E Wall St',
    phone: '(432) 684-8686',
    rating: 4.5,
    reviewCount: 287,
    priceLevel: 2,
    distance: '3.4 mi',
    hours: { open: '11:00 AM', close: '11:00 PM', isOpen: true },
    features: ['Steaks', 'Bar', 'Sports TV'],
    description: 'Great steaks and burgers with sports bar atmosphere.',
  },
  {
    id: 'rest3',
    name: 'Whataburger',
    category: 'restaurant',
    address: '4600 N Midland Dr',
    phone: '(432) 697-4241',
    rating: 4.2,
    reviewCount: 156,
    priceLevel: 1,
    distance: '0.8 mi',
    hours: { open: '24/7', close: '24/7', isOpen: true },
    features: ['24 Hours', 'Drive-Thru', 'Late Night'],
    description: 'Texas classic. Open 24/7 for late night cravings.',
  },
  {
    id: 'rest4',
    name: 'Rosa\'s Cafe',
    category: 'restaurant',
    address: '3205 N Big Spring St',
    phone: '(432) 687-1177',
    rating: 4.4,
    reviewCount: 423,
    priceLevel: 1,
    distance: '1.2 mi',
    hours: { open: '6:30 AM', close: '9:00 PM', isOpen: true },
    features: ['Tex-Mex', 'Breakfast', 'Family-Friendly'],
    description: 'Authentic Tex-Mex. Great breakfast tacos starting at 6:30am.',
  },
  // Coffee
  {
    id: 'coffee1',
    name: 'Starbucks - Midland Park',
    category: 'coffee',
    address: '4511 N Midkiff Rd',
    phone: '(432) 699-1234',
    rating: 4.1,
    reviewCount: 89,
    priceLevel: 2,
    distance: '0.5 mi',
    hours: { open: '5:00 AM', close: '9:00 PM', isOpen: true },
    features: ['Drive-Thru', 'WiFi', 'Mobile Order'],
    description: 'Reliable coffee with fast service and good WiFi.',
  },
  {
    id: 'coffee2',
    name: 'Grounded Coffee',
    category: 'coffee',
    address: '501 N Big Spring St',
    phone: '(432) 238-7722',
    rating: 4.8,
    reviewCount: 234,
    priceLevel: 2,
    distance: '2.8 mi',
    hours: { open: '7:00 AM', close: '6:00 PM', isOpen: true },
    features: ['Local', 'Artisan', 'Quiet Space'],
    description: 'Local favorite with excellent pour-over and pastries.',
  },
  // Hardware
  {
    id: 'hw1',
    name: 'Home Depot',
    category: 'hardware',
    address: '4701 N Midkiff Rd',
    phone: '(432) 699-5800',
    rating: 4.3,
    reviewCount: 178,
    priceLevel: 2,
    distance: '0.6 mi',
    hours: { open: '6:00 AM', close: '10:00 PM', isOpen: true },
    features: ['Opens Early', 'Tool Rental', 'Pro Desk'],
    description: 'Opens at 6am. Great for work crews needing supplies.',
  },
  {
    id: 'hw2',
    name: 'Lowe\'s',
    category: 'hardware',
    address: '4300 N Midland Dr',
    phone: '(432) 699-0900',
    rating: 4.2,
    reviewCount: 145,
    priceLevel: 2,
    distance: '0.9 mi',
    hours: { open: '6:00 AM', close: '10:00 PM', isOpen: true },
    features: ['Opens Early', 'Appliances', 'Garden Center'],
    description: 'Full hardware store with garden center.',
  },
  // Bars
  {
    id: 'bar1',
    name: 'The Blue Door',
    category: 'bar',
    address: '123 E Wall St',
    phone: '(432) 684-2222',
    rating: 4.4,
    reviewCount: 198,
    priceLevel: 2,
    distance: '3.5 mi',
    hours: { open: '4:00 PM', close: '2:00 AM', isOpen: true },
    features: ['Craft Cocktails', 'Live Music', 'Patio'],
    description: 'Best craft cocktails in Midland with live music weekends.',
  },
  {
    id: 'bar2',
    name: 'Tall City Brewing',
    category: 'bar',
    address: '203 E Texas Ave',
    phone: '(432) 684-2739',
    rating: 4.6,
    reviewCount: 267,
    priceLevel: 2,
    distance: '3.2 mi',
    hours: { open: '12:00 PM', close: '10:00 PM', isOpen: true },
    features: ['Local Brewery', 'Food Trucks', 'Dog-Friendly'],
    description: 'Local craft brewery with rotating food trucks.',
  },
  // Laundromats
  {
    id: 'laund1',
    name: 'Spin Zone Laundry',
    category: 'laundromat',
    address: '3110 W Wadley Ave',
    phone: '(432) 697-8888',
    rating: 4.0,
    reviewCount: 67,
    priceLevel: 1,
    distance: '1.8 mi',
    hours: { open: '6:00 AM', close: '11:00 PM', isOpen: true },
    features: ['Large Machines', 'Drop-Off Service', 'WiFi'],
    description: 'Industrial-size machines for work clothes. Drop-off available.',
  },
  // Gas
  {
    id: 'gas1',
    name: 'Buc-ee\'s',
    category: 'gas',
    address: '9501 E Interstate 20',
    phone: '(432) 563-2800',
    rating: 4.8,
    reviewCount: 1234,
    priceLevel: 2,
    distance: '12.3 mi',
    hours: { open: '24/7', close: '24/7', isOpen: true },
    features: ['24 Hours', 'Clean Restrooms', 'Texas Famous'],
    description: 'Texas institution. Best restrooms and beaver nuggets!',
  },
  // Attractions
  {
    id: 'attr1',
    name: 'Petroleum Museum',
    category: 'attraction',
    address: '1500 I-20 W',
    phone: '(432) 683-4403',
    rating: 4.5,
    reviewCount: 312,
    priceLevel: 2,
    distance: '4.1 mi',
    hours: { open: '10:00 AM', close: '5:00 PM', isOpen: true },
    features: ['Family-Friendly', 'Interactive', 'Educational'],
    description: 'Learn about the oil industry that built Midland. Great for families!',
  },
  {
    id: 'attr2',
    name: 'Sibley Nature Center',
    category: 'attraction',
    address: '1307 E Wadley Ave',
    phone: '(432) 684-6827',
    rating: 4.3,
    reviewCount: 89,
    priceLevel: 1,
    distance: '2.9 mi',
    hours: { open: '9:00 AM', close: '5:00 PM', isOpen: true },
    features: ['Nature Trails', 'Free', 'Bird Watching'],
    description: 'Free nature center with trails. Great for a peaceful walk.',
  },
  // Medical
  {
    id: 'med1',
    name: 'Midland Memorial Hospital',
    category: 'medical',
    address: '400 Rosalind Redfern Grover Pkwy',
    phone: '(432) 221-1111',
    rating: 3.9,
    reviewCount: 234,
    priceLevel: 4,
    distance: '3.8 mi',
    hours: { open: '24/7', close: '24/7', isOpen: true },
    features: ['24/7 ER', 'Full Hospital', 'Trauma Center'],
    description: 'Full-service hospital with 24/7 emergency room.',
  },
  {
    id: 'med2',
    name: 'CVS MinuteClinic',
    category: 'medical',
    address: '4610 N Midkiff Rd',
    phone: '(432) 699-4600',
    rating: 4.0,
    reviewCount: 56,
    priceLevel: 2,
    distance: '0.4 mi',
    hours: { open: '8:00 AM', close: '7:00 PM', isOpen: true },
    features: ['Walk-In', 'Vaccinations', 'Minor Illness'],
    description: 'Walk-in clinic for minor medical needs. No appointment needed.',
  },
];

// ============================================================================
// GUEST TYPE CONFIG
// ============================================================================

const guestTypes: { value: GuestType; label: string; icon: any; description: string; color: string }[] = [
  { value: 'work_crew', label: 'Work Crew', icon: Wrench, description: 'Oil field, construction, contractors', color: '#F59E0B' },
  { value: 'family', label: 'Family', icon: Home, description: 'Traveling with kids', color: '#10B981' },
  { value: 'couple', label: 'Couple', icon: Heart, description: 'Romantic getaway', color: '#EC4899' },
  { value: 'business', label: 'Business', icon: Briefcase, description: 'Work travel', color: '#3B82F6' },
  { value: 'general', label: 'General', icon: Users, description: 'Just exploring', color: '#8B5CF6' },
];

// ============================================================================
// QUICK ACTIONS BY GUEST TYPE
// ============================================================================

const quickActionsByType: Record<GuestType, { icon: any; label: string; query: string; category: string }[]> = {
  work_crew: [
    { icon: Wrench, label: 'Hardware Stores', query: 'Where are hardware stores that open early?', category: 'hardware' },
    { icon: Utensils, label: 'Early Breakfast', query: 'Where can I get breakfast at 5am?', category: 'restaurant' },
    { icon: Droplets, label: 'Laundromats', query: 'Where can I wash work clothes?', category: 'laundromat' },
    { icon: Fuel, label: 'Gas Stations', query: 'Where is the nearest gas station?', category: 'gas' },
    { icon: Coffee, label: 'Coffee Shops', query: 'Where can I get coffee early?', category: 'coffee' },
    { icon: Wifi, label: 'WiFi Password', query: 'What is the WiFi password?', category: 'property' },
  ],
  family: [
    { icon: Utensils, label: 'Kid-Friendly Food', query: 'Where are family-friendly restaurants?', category: 'restaurant' },
    { icon: MapPin, label: 'Attractions', query: 'What family attractions are nearby?', category: 'attraction' },
    { icon: Droplets, label: 'Pool Properties', query: 'Which properties have pools?', category: 'property' },
    { icon: ShoppingBag, label: 'Grocery Stores', query: 'Where are the grocery stores?', category: 'grocery' },
    { icon: Building2, label: 'Urgent Care', query: 'Where is the nearest urgent care?', category: 'medical' },
    { icon: Key, label: 'Check-in Info', query: 'What time is check-in and how do I get in?', category: 'property' },
  ],
  couple: [
    { icon: Utensils, label: 'Romantic Dining', query: 'What are the best romantic restaurants?', category: 'restaurant' },
    { icon: Wine, label: 'Wine & Cocktails', query: 'Where are the best bars for cocktails?', category: 'bar' },
    { icon: Thermometer, label: 'Hot Tub Properties', query: 'Which properties have hot tubs?', category: 'property' },
    { icon: Coffee, label: 'Cozy Cafes', query: 'Where are nice coffee shops?', category: 'coffee' },
    { icon: MapPin, label: 'Date Ideas', query: 'What are fun date ideas in Midland?', category: 'attraction' },
    { icon: Clock, label: 'Checkout Time', query: 'What time is checkout?', category: 'property' },
  ],
  business: [
    { icon: Coffee, label: 'Coffee & WiFi', query: 'Where can I work with good WiFi?', category: 'coffee' },
    { icon: Utensils, label: 'Quick Lunch', query: 'Where can I get a quick business lunch?', category: 'restaurant' },
    { icon: Wifi, label: 'WiFi Info', query: 'What is the WiFi password and speed?', category: 'property' },
    { icon: Car, label: 'Airport', query: 'How do I get to the airport?', category: 'directions' },
    { icon: Briefcase, label: 'Print/Ship', query: 'Where can I print or ship packages?', category: 'services' },
    { icon: Clock, label: 'Late Checkout', query: 'Can I get a late checkout?', category: 'property' },
  ],
  general: [
    { icon: Utensils, label: 'Restaurants', query: 'What are the best restaurants nearby?', category: 'restaurant' },
    { icon: Wine, label: 'Bars & Nightlife', query: 'Where can I get a good drink?', category: 'bar' },
    { icon: MapPin, label: 'Attractions', query: 'What attractions should I visit?', category: 'attraction' },
    { icon: Coffee, label: 'Coffee', query: 'Where is the best coffee?', category: 'coffee' },
    { icon: Wifi, label: 'WiFi Password', query: 'What is the WiFi password?', category: 'property' },
    { icon: Clock, label: 'Checkout Info', query: 'What time is checkout and what do I need to do?', category: 'property' },
  ],
};

// ============================================================================
// PROPERTY INFO
// ============================================================================

const propertyInfo = {
  wifiPassword: 'RightAtHome2024',
  checkIn: '3:00 PM',
  checkOut: '11:00 AM',
  emergencyContact: '(432) 559-1904',
  ownerName: 'Steven Palma',
  address: 'Midland, TX',
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Category Icon Map
const categoryIcons: Record<BusinessCategory, any> = {
  restaurant: Utensils,
  bar: Wine,
  coffee: Coffee,
  grocery: ShoppingBag,
  hardware: Wrench,
  gas: Fuel,
  laundromat: Droplets,
  medical: Building2,
  attraction: MapPin,
  shopping: ShoppingBag,
};

// Price Level Display
function PriceLevel({ level }: { level: number }) {
  return (
    <span className="text-[#2D2D2D]/60 text-sm">
      {Array.from({ length: 4 }).map((_, i) => (
        <DollarSign
          key={i}
          className={`w-3 h-3 inline ${i < level ? 'text-[#C4A777]' : 'text-[#2D2D2D]/20'}`}
        />
      ))}
    </span>
  );
}

// Star Rating Display
function StarRating({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <div className="flex items-center gap-1">
      <Star className="w-4 h-4 text-[#C4A777] fill-[#C4A777]" />
      <span className="font-medium text-[#2D2D2D]">{rating.toFixed(1)}</span>
      <span className="text-[#2D2D2D]/50 text-sm">({reviewCount})</span>
    </div>
  );
}

// Business Card Component
function BusinessCard({ business, onCall, onDirections }: {
  business: LocalBusiness;
  onCall: () => void;
  onDirections: () => void;
}) {
  const Icon = categoryIcons[business.category] || MapPin;
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-[#2D2D2D]/10 overflow-hidden hover:border-[#500000]/30 transition-colors"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#500000]/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#500000]" />
            </div>
            <div>
              <h4 className="font-semibold text-[#2D2D2D]">{business.name}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <StarRating rating={business.rating} reviewCount={business.reviewCount} />
                <span className="text-[#2D2D2D]/30">|</span>
                <PriceLevel level={business.priceLevel} />
              </div>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            business.hours.isOpen
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {business.hours.isOpen ? 'Open' : 'Closed'}
          </div>
        </div>

        <p className="text-sm text-[#2D2D2D]/70 mb-3">{business.description}</p>

        <div className="flex items-center gap-4 text-sm text-[#2D2D2D]/60 mb-3">
          <span className="flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5" />
            {business.distance}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {business.hours.open} - {business.hours.close}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {business.features.map((feature) => (
            <span
              key={feature}
              className="px-2 py-0.5 bg-[#F5F5F0] rounded-full text-xs text-[#2D2D2D]/70"
            >
              {feature}
            </span>
          ))}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-[#2D2D2D]/10 space-y-2">
                <p className="text-sm text-[#2D2D2D]/70 flex items-start gap-2">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {business.address}
                </p>
                {business.phone && (
                  <p className="text-sm text-[#2D2D2D]/70 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {business.phone}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#2D2D2D]/10">
          {business.phone && (
            <button
              onClick={onCall}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#500000] text-white rounded-lg hover:bg-[#722F37] transition-colors text-sm"
            >
              <Phone className="w-4 h-4" />
              Call
            </button>
          )}
          <button
            onClick={onDirections}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#500000]/10 text-[#500000] rounded-lg hover:bg-[#500000]/20 transition-colors text-sm"
          >
            <Navigation className="w-4 h-4" />
            Directions
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-[#2D2D2D]/60 hover:text-[#500000] transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Typing Indicator Component
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2 px-4 py-3 bg-white rounded-2xl border border-[#2D2D2D]/10 w-fit"
    >
      <div className="w-8 h-8 rounded-full bg-[#500000]/10 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-[#500000]" />
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-[#500000]/60"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Suggested Reply Chip
function SuggestedReply({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="px-4 py-2 bg-white border border-[#500000]/30 text-[#500000] rounded-full text-sm hover:bg-[#500000]/10 transition-colors whitespace-nowrap"
    >
      {text}
    </motion.button>
  );
}

// Message Component
function MessageBubble({
  message,
  onFeedback,
  onCopy,
  onSuggestedReply
}: {
  message: Message;
  onFeedback: (type: 'positive' | 'negative') => void;
  onCopy: () => void;
  onSuggestedReply: (reply: string) => void;
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="px-4 py-1.5 bg-[#500000]/10 text-[#500000] text-sm rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isUser ? '' : 'space-y-3'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-[#500000] text-white'
              : 'bg-white border border-[#2D2D2D]/10'
          }`}
        >
          <div className="flex items-start gap-3">
            {!isUser && (
              <div className="w-8 h-8 rounded-full bg-[#500000]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-[#500000]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`whitespace-pre-wrap text-sm ${
                isUser ? 'text-white' : 'text-[#2D2D2D]'
              }`}>
                {message.content}
              </p>
              {message.category && !isUser && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-[#500000]/10 text-[#500000] text-xs rounded-full">
                  {message.category}
                </span>
              )}
            </div>
            {isUser && (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Timestamp and actions for assistant */}
          {!isUser && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2D2D2D]/5">
              <span className="text-xs text-[#2D2D2D]/40">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={onCopy}
                  className="p-1.5 text-[#2D2D2D]/40 hover:text-[#500000] transition-colors"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback('positive')}
                  className={`p-1.5 transition-colors ${
                    message.feedback === 'positive'
                      ? 'text-green-500'
                      : 'text-[#2D2D2D]/40 hover:text-green-500'
                  }`}
                  title="Helpful"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback('negative')}
                  className={`p-1.5 transition-colors ${
                    message.feedback === 'negative'
                      ? 'text-red-500'
                      : 'text-[#2D2D2D]/40 hover:text-red-500'
                  }`}
                  title="Not helpful"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Timestamp for user */}
          {isUser && (
            <div className="flex justify-end mt-2">
              <span className="text-xs text-white/60">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {message.recommendations && message.recommendations.length > 0 && (
          <div className="space-y-2 mt-3">
            {message.recommendations.map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
                onCall={() => {
                  if (business.phone) {
                    window.open(`tel:${business.phone}`);
                  }
                }}
                onDirections={() => {
                  window.open(`https://maps.google.com/?q=${encodeURIComponent(business.address)}`);
                }}
              />
            ))}
          </div>
        )}

        {/* Suggested Replies */}
        {message.suggestedReplies && message.suggestedReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.suggestedReplies.map((reply, idx) => (
              <SuggestedReply
                key={idx}
                text={reply}
                onClick={() => onSuggestedReply(reply)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConciergePage() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [guestType, setGuestType] = useState<GuestType>('general');
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [savedBusinesses, setSavedBusinesses] = useState<string[]>([]);
  const [sessionId] = useState(`session_${Date.now()}`);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        if (isListening) setIsListening(false);
      }
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        toggleVoiceInput();
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        setVoiceEnabled(!voiceEnabled);
        toast(voiceEnabled ? 'Voice output disabled' : 'Voice output enabled');
      }
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHelp, isListening, voiceEnabled]);

  // Get welcome message based on guest type
  const getWelcomeMessage = useCallback((type: GuestType): { content: string; suggestedReplies: string[] } => {
    const baseWelcome = `Welcome to Right at Home BnB! I'm your AI concierge, here to make your stay in Midland perfect.`;

    const welcomeMessages: Record<GuestType, { content: string; suggestedReplies: string[] }> = {
      work_crew: {
        content: `${baseWelcome}

I know you're here to work hard! I can help you with:
- Hardware stores (Home Depot opens at 6am!)
- Early breakfast spots (Whataburger is 24/7)
- Laundromats with large machines for work clothes
- Late-night food after long shifts
- Property amenities and WiFi

What do you need?`,
        suggestedReplies: ['Where can I get breakfast at 5am?', 'What is the WiFi password?', 'Where are hardware stores?'],
      },
      family: {
        content: `${baseWelcome}

I'm excited to help your family have a great time! I can help with:
- Family-friendly restaurants
- Parks and playgrounds
- Kid-friendly attractions (Petroleum Museum is fun!)
- Properties with pools and yards
- Local events happening during your stay

How can I make your family trip amazing?`,
        suggestedReplies: ['What family attractions are nearby?', 'Where are family-friendly restaurants?', 'Do any properties have pools?'],
      },
      couple: {
        content: `${baseWelcome}

How wonderful! I can help you find:
- Romantic dinner spots (The Garlic Press is great!)
- Properties with hot tubs for relaxing evenings
- Wine bars and upscale lounges
- Quiet, private accommodations
- Special experiences in the area

What would you like to know?`,
        suggestedReplies: ['Best romantic restaurants?', 'Where are the best cocktail bars?', 'Which properties have hot tubs?'],
      },
      business: {
        content: `${baseWelcome}

I understand you need efficiency! I can help with:
- Good WiFi and work-from-home setups
- Quick, quality dining options
- Coffee shops for meetings
- Business-friendly amenities
- Directions and local tips

What can I help you find?`,
        suggestedReplies: ['Where can I work with good WiFi?', 'Quick lunch options?', 'How do I get to the airport?'],
      },
      general: {
        content: `${baseWelcome}

I can help you with:
- Restaurant & bar recommendations
- Local attractions & events
- Property info (WiFi, checkout, amenities)
- Directions and maps
- Pool and hot tub properties

How can I assist you today?`,
        suggestedReplies: ['Best restaurants nearby?', 'What attractions should I visit?', 'What is the WiFi password?'],
      },
    };

    return welcomeMessages[type];
  }, []);

  // Select guest type and initialize chat
  const selectGuestType = useCallback((type: GuestType) => {
    setGuestType(type);
    setShowTypeSelector(false);
    const welcome = getWelcomeMessage(type);
    setMessages([{
      id: '1',
      role: 'assistant',
      content: welcome.content,
      timestamp: new Date(),
      suggestedReplies: welcome.suggestedReplies,
    }]);
    toast.success(`${guestTypes.find(t => t.value === type)?.label} mode activated`);
  }, [getWelcomeMessage]);

  // Generate AI response (simulated)
  const generateResponse = useCallback((query: string): {
    content: string;
    recommendations?: LocalBusiness[];
    suggestedReplies?: string[];
    category?: string;
  } => {
    const lowerQuery = query.toLowerCase();

    // WiFi Password
    if (lowerQuery.includes('wifi') || lowerQuery.includes('wi-fi') || lowerQuery.includes('internet')) {
      return {
        content: `The WiFi password is: **${propertyInfo.wifiPassword}**\n\nNetwork name is usually the property address. If you have any connection issues, try restarting the router (usually in the living room) or contact Steven at ${propertyInfo.emergencyContact}.`,
        category: 'Property Info',
        suggestedReplies: ['What time is checkout?', 'How do I control the thermostat?', 'Is there a smart TV?'],
      };
    }

    // Check-in/Check-out
    if (lowerQuery.includes('checkout') || lowerQuery.includes('check out') || lowerQuery.includes('check-out')) {
      return {
        content: `Checkout is at **${propertyInfo.checkOut}**.\n\nBefore you leave:\n- Please start a load of towels in the washer\n- Take out any trash to the bins\n- Lock all doors and windows\n- Leave the keys on the kitchen counter\n- Set the thermostat to 72°F\n\nNo need to strip the beds - we'll handle that! Safe travels!`,
        category: 'Property Info',
        suggestedReplies: ['Can I get a late checkout?', 'Where are the trash bins?', 'Thanks for everything!'],
      };
    }

    if (lowerQuery.includes('checkin') || lowerQuery.includes('check in') || lowerQuery.includes('check-in')) {
      return {
        content: `Check-in is at **${propertyInfo.checkIn}**.\n\nYour door code will be sent via text on check-in day. If you need early check-in, just ask and I'll check availability!\n\nWhen you arrive:\n- Enter through the front door using your code\n- WiFi password is on the fridge\n- Thermostat is in the hallway\n- Fresh towels are in the bathroom closet`,
        category: 'Property Info',
        suggestedReplies: ['Can I check in early?', 'What is the WiFi password?', 'Where do I park?'],
      };
    }

    // Restaurants
    if (lowerQuery.includes('restaurant') || lowerQuery.includes('food') || lowerQuery.includes('eat') || lowerQuery.includes('dinner') || lowerQuery.includes('lunch')) {
      const restaurants = localBusinesses.filter(b => b.category === 'restaurant');

      let filtered = restaurants;
      if (lowerQuery.includes('romantic') || lowerQuery.includes('date') || lowerQuery.includes('fancy')) {
        filtered = restaurants.filter(r => r.priceLevel >= 3 || r.features.some(f => f.toLowerCase().includes('romantic') || f.toLowerCase().includes('fine dining')));
      } else if (lowerQuery.includes('family') || lowerQuery.includes('kid')) {
        filtered = restaurants.filter(r => r.features.some(f => f.toLowerCase().includes('family')));
      } else if (lowerQuery.includes('quick') || lowerQuery.includes('fast')) {
        filtered = restaurants.filter(r => r.priceLevel <= 2);
      } else if (lowerQuery.includes('early') || lowerQuery.includes('breakfast') || lowerQuery.includes('5am') || lowerQuery.includes('6am')) {
        filtered = restaurants.filter(r => r.hours.open.includes('24/7') || parseInt(r.hours.open) <= 7);
      }

      return {
        content: `Here are some great restaurant options for you:`,
        recommendations: filtered.slice(0, 3),
        category: 'Restaurants',
        suggestedReplies: ['Any other options?', 'Which has the best reviews?', 'What about bars?'],
      };
    }

    // Bars
    if (lowerQuery.includes('bar') || lowerQuery.includes('drink') || lowerQuery.includes('cocktail') || lowerQuery.includes('beer') || lowerQuery.includes('wine')) {
      const bars = localBusinesses.filter(b => b.category === 'bar');
      return {
        content: `Here are the best spots for drinks in Midland:`,
        recommendations: bars.slice(0, 3),
        category: 'Bars & Nightlife',
        suggestedReplies: ['Which has live music?', 'Any happy hour deals?', 'What about restaurants?'],
      };
    }

    // Coffee
    if (lowerQuery.includes('coffee') || lowerQuery.includes('cafe') || lowerQuery.includes('caffeine')) {
      const coffee = localBusinesses.filter(b => b.category === 'coffee');
      return {
        content: `Here are the best coffee spots:`,
        recommendations: coffee.slice(0, 3),
        category: 'Coffee',
        suggestedReplies: ['Which opens earliest?', 'Which has the best WiFi?', 'Any local favorites?'],
      };
    }

    // Hardware
    if (lowerQuery.includes('hardware') || lowerQuery.includes('home depot') || lowerQuery.includes('lowes') || lowerQuery.includes('tools')) {
      const hardware = localBusinesses.filter(b => b.category === 'hardware');
      return {
        content: `Here are hardware stores nearby. Both Home Depot and Lowe's open at 6am for early birds!`,
        recommendations: hardware.slice(0, 3),
        category: 'Hardware Stores',
        suggestedReplies: ['Which opens earliest?', 'Do they rent tools?', 'Where can I get work supplies?'],
      };
    }

    // Laundromat
    if (lowerQuery.includes('laundry') || lowerQuery.includes('laundromat') || lowerQuery.includes('wash clothes')) {
      const laundry = localBusinesses.filter(b => b.category === 'laundromat');
      return {
        content: `Here's a great laundromat with industrial-size machines perfect for work clothes:`,
        recommendations: laundry.slice(0, 2),
        category: 'Laundry',
        suggestedReplies: ['Do they have drop-off service?', 'What about dry cleaning?', 'Early breakfast nearby?'],
      };
    }

    // Attractions
    if (lowerQuery.includes('attraction') || lowerQuery.includes('visit') || lowerQuery.includes('do') || lowerQuery.includes('see') || lowerQuery.includes('fun')) {
      const attractions = localBusinesses.filter(b => b.category === 'attraction');
      return {
        content: `Here are some great things to do in Midland:`,
        recommendations: attractions.slice(0, 3),
        category: 'Attractions',
        suggestedReplies: ['Any free activities?', 'What about for kids?', 'Indoor options?'],
      };
    }

    // Medical/Emergency
    if (lowerQuery.includes('hospital') || lowerQuery.includes('doctor') || lowerQuery.includes('medical') || lowerQuery.includes('urgent') || lowerQuery.includes('emergency') || lowerQuery.includes('sick')) {
      const medical = localBusinesses.filter(b => b.category === 'medical');
      return {
        content: `For medical needs:\n\n**Emergency (911)** - For life-threatening emergencies\n\nHere are your local healthcare options:`,
        recommendations: medical.slice(0, 2),
        category: 'Medical',
        suggestedReplies: ['Where is the nearest pharmacy?', 'Contact property owner', 'Thanks'],
      };
    }

    // Gas
    if (lowerQuery.includes('gas') || lowerQuery.includes('fuel') || lowerQuery.includes('petrol')) {
      const gas = localBusinesses.filter(b => b.category === 'gas');
      return {
        content: `Here's the best gas station option. Buc-ee's is a Texas must-visit if you have time!`,
        recommendations: gas.slice(0, 2),
        category: 'Gas Stations',
        suggestedReplies: ['Which is closest?', 'Any 24-hour options?', 'Where is the cheapest gas?'],
      };
    }

    // Hot tub / Pool
    if (lowerQuery.includes('hot tub') || lowerQuery.includes('pool') || lowerQuery.includes('swim')) {
      return {
        content: `Several of our properties have pools and hot tubs! Let me know which property you're staying at and I can confirm the amenities.\n\n**Properties with Hot Tubs:**\n- 2300 Princeton Ave\n- 4014 Monty Dr\n- 3210 Frontier Ave\n\n**Properties with Pools:**\n- 2505 Kessler Ave\n- 4014 Monty Dr\n\nContact Steven at ${propertyInfo.emergencyContact} for specific amenity questions!`,
        category: 'Property Amenities',
        suggestedReplies: ['Pool hours?', 'Hot tub temperature?', 'Other amenities?'],
      };
    }

    // Contact owner
    if (lowerQuery.includes('steven') || lowerQuery.includes('owner') || lowerQuery.includes('contact') || lowerQuery.includes('help') || lowerQuery.includes('problem')) {
      return {
        content: `You can reach Steven Palma directly at:\n\n**Phone:** ${propertyInfo.emergencyContact}\n**Text:** ${propertyInfo.emergencyContact}\n\nSteven is typically available from 8am-10pm, but will respond to emergencies 24/7.\n\nFor true emergencies, call 911 first!`,
        category: 'Contact',
        suggestedReplies: ['Thanks!', 'Any other questions', 'Go back to main menu'],
      };
    }

    // Default response
    return {
      content: `I'd be happy to help with that! Here's what I can assist you with:\n\n- **Local Recommendations**: Restaurants, bars, coffee, attractions\n- **Property Info**: WiFi, checkout times, amenities\n- **Work Crew Needs**: Hardware stores, laundromats, early breakfast\n- **Emergency Info**: Medical, police, fire\n- **Contact Owner**: Steven at ${propertyInfo.emergencyContact}\n\nWhat would you like to know more about?`,
      suggestedReplies: ['Best restaurants?', 'WiFi password?', 'Contact Steven'],
    };
  }, []);

  // Handle sending message
  const handleSend = useCallback(async (query?: string) => {
    const messageText = query || input.trim();
    if (!messageText) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));

    // Generate response
    const response = generateResponse(messageText);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      category: response.category,
      recommendations: response.recommendations,
      suggestedReplies: response.suggestedReplies,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsTyping(false);

    // Speak response if voice enabled
    if (voiceEnabled && response.content) {
      speakResponse(response.content);
    }
  }, [input, generateResponse, voiceEnabled]);

  // Text to speech
  const speakResponse = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(true);

      // Clean text for speech (remove markdown)
      const cleanText = text.replace(/\*\*/g, '').replace(/\n/g, '. ');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Voice input
  const toggleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice input is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      toast('Listening... Speak now', { icon: '🎤' });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      if (event.results[0].isFinal) {
        setTimeout(() => handleSend(transcript), 300);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      toast.error(`Voice error: ${event.error}`);
    };

    recognition.start();
  }, [isListening, handleSend]);

  // Handle feedback
  const handleFeedback = useCallback((messageId: string, type: 'positive' | 'negative') => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, feedback: type } : m
    ));
    toast.success(type === 'positive' ? 'Thanks for the feedback!' : 'Sorry about that. We\'ll improve!');
  }, []);

  // Copy message
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content.replace(/\*\*/g, ''));
    toast.success('Copied to clipboard');
  }, []);

  // Current quick actions
  const currentQuickActions = useMemo(() =>
    quickActionsByType[guestType] || quickActionsByType.general
  , [guestType]);

  // Guest type selector screen
  if (showTypeSelector) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center mb-4 shadow-lg"
            >
              <Bot className="w-12 h-12 text-white" />
            </motion.div>
            <h1 className="text-3xl font-['Playfair_Display'] font-semibold text-[#500000] mb-2">
              Welcome to Right at Home BnB
            </h1>
            <p className="text-[#2D2D2D]/60 mb-1">
              Your AI Concierge for Midland, TX
            </p>
            <p className="text-sm text-[#C4A777]">
              Owner: Steven Palma | {propertyInfo.emergencyContact}
            </p>
          </div>

          <p className="text-center text-[#2D2D2D]/70 mb-4">
            Tell us about your stay so we can personalize your experience:
          </p>

          <div className="space-y-3">
            {guestTypes.map((type, idx) => (
              <motion.button
                key={type.value}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ scale: 1.02, x: 8 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => selectGuestType(type.value)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-[#2D2D2D]/10 hover:border-[#500000]/30 hover:shadow-md transition-all text-left group"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${type.color}20` }}
                >
                  <type.icon className="w-7 h-7" style={{ color: type.color }} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#2D2D2D] text-lg">{type.label}</p>
                  <p className="text-sm text-[#2D2D2D]/60">{type.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#2D2D2D]/40 group-hover:text-[#500000] group-hover:translate-x-1 transition-all" />
              </motion.button>
            ))}
          </div>

          <p className="text-center text-xs text-[#2D2D2D]/40 mt-6">
            Press <kbd className="px-1.5 py-0.5 bg-white rounded border text-xs">Ctrl+M</kbd> anytime for voice input
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center shadow-md"
              >
                <Bot className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-xl font-['Playfair_Display'] font-semibold text-[#500000]">
                  AI Concierge
                </h1>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${guestTypes.find(t => t.value === guestType)?.color}20`,
                      color: guestTypes.find(t => t.value === guestType)?.color,
                    }}
                  >
                    {guestTypes.find(t => t.value === guestType)?.label} Mode
                  </span>
                  {isSpeaking && (
                    <span className="text-xs text-[#C4A777] flex items-center gap-1">
                      <Volume2 className="w-3 h-3 animate-pulse" />
                      Speaking...
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTypeSelector(true)}
                className="px-3 py-1.5 text-sm rounded-lg bg-[#500000]/10 text-[#500000] hover:bg-[#500000]/20 transition-colors"
              >
                Change
              </button>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-2 rounded-lg transition-colors ${
                  voiceEnabled ? 'bg-[#500000]/10 text-[#500000]' : 'bg-gray-100 text-gray-400'
                }`}
                title={voiceEnabled ? 'Disable voice (Ctrl+S)' : 'Enable voice (Ctrl+S)'}
              >
                {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowHelp(true)}
                className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title="Help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-36">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-sm text-[#2D2D2D]/60 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#C4A777]" />
            Quick Actions
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {currentQuickActions.map((action, idx) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSend(action.query)}
                className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-lg border border-[#2D2D2D]/10 hover:border-[#500000]/30 hover:bg-[#500000]/5 transition-colors text-left"
              >
                <action.icon className="w-4 h-4 text-[#500000]" />
                <span className="text-sm text-[#2D2D2D] truncate">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Messages */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onFeedback={(type) => handleFeedback(message.id, type)}
                onCopy={() => handleCopy(message.content)}
                onSuggestedReply={(reply) => handleSend(reply)}
              />
            ))}
          </AnimatePresence>

          {isTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#2D2D2D]/10 p-4 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleVoiceInput}
              className={`p-3 rounded-xl transition-colors ${
                isListening
                  ? 'bg-red-500 text-white'
                  : 'bg-[#500000]/10 text-[#500000] hover:bg-[#500000]/20'
              }`}
              title="Voice input (Ctrl+M)"
            >
              {isListening ? (
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  <MicOff className="w-5 h-5" />
                </motion.div>
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </motion.button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? 'Listening...' : 'Ask me anything about your stay...'}
                className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-0 focus:ring-2 focus:ring-[#500000]/20 text-[#2D2D2D] placeholder-[#2D2D2D]/40"
                disabled={isListening || isTyping}
              />
              {input && (
                <button
                  onClick={() => setInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#2D2D2D]/40 hover:text-[#500000]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="p-3 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-[#2D2D2D]/40">
              Press <kbd className="px-1 py-0.5 bg-[#F5F5F0] rounded text-[10px]">/</kbd> to focus |{' '}
              <kbd className="px-1 py-0.5 bg-[#F5F5F0] rounded text-[10px]">Ctrl+M</kbd> for voice
            </p>
            <p className="text-xs text-[#2D2D2D]/40">
              Emergency: 911 | Steven: {propertyInfo.emergencyContact}
            </p>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-['Playfair_Display'] font-semibold text-[#500000]">
                    How to Use the Concierge
                  </h2>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="p-2 text-[#2D2D2D]/60 hover:text-[#500000]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-[#2D2D2D] mb-2">Ask me about:</h3>
                    <ul className="text-sm text-[#2D2D2D]/70 space-y-1">
                      <li>- Restaurant & bar recommendations</li>
                      <li>- WiFi password & property info</li>
                      <li>- Check-in/Check-out times</li>
                      <li>- Local attractions & events</li>
                      <li>- Hardware stores & work supplies</li>
                      <li>- Medical & emergency services</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-[#2D2D2D] mb-2">Keyboard Shortcuts:</h3>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[#2D2D2D]/70">Focus input</span>
                        <kbd className="px-2 py-1 bg-[#F5F5F0] rounded text-xs">/</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#2D2D2D]/70">Voice input</span>
                        <kbd className="px-2 py-1 bg-[#F5F5F0] rounded text-xs">Ctrl+M</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#2D2D2D]/70">Toggle voice output</span>
                        <kbd className="px-2 py-1 bg-[#F5F5F0] rounded text-xs">Ctrl+S</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#2D2D2D]/70">Close dialogs</span>
                        <kbd className="px-2 py-1 bg-[#F5F5F0] rounded text-xs">Esc</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#2D2D2D]/10">
                    <h3 className="font-semibold text-[#2D2D2D] mb-2">Contact Owner:</h3>
                    <div className="flex items-center gap-3 p-3 bg-[#500000]/5 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-[#500000] flex items-center justify-center text-white font-semibold">
                        SP
                      </div>
                      <div>
                        <p className="font-medium text-[#2D2D2D]">{propertyInfo.ownerName}</p>
                        <a href={`tel:${propertyInfo.emergencyContact}`} className="text-sm text-[#500000]">
                          {propertyInfo.emergencyContact}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
