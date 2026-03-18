'use client';

/**
 * Right at Home BnB - Message Hub
 * AI-generated messages, conversation threading, sentiment analysis, automated flows
 * @author ECHO OMEGA PRIME - ENHANCED
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  MessageSquare, Send, Check, X, Clock, Sparkles, Mail,
  Phone, Bell, Filter, Search, Edit, Eye, RefreshCw,
  ChevronRight, AlertCircle, CheckCircle, ThumbsUp, ThumbsDown,
  User, Calendar, ArrowRight, Zap, Bot, Settings,
  ChevronDown, ChevronUp, MoreHorizontal, Trash2, Copy,
  Play, Pause, Plus, Save, FileText, BarChart3, Globe,
  MessageCircle, Home, Smile, Meh, Frown, Heart, Star,
  ExternalLink, Archive, Pin, Flag, Tag, Link2
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Message {
  id: string;
  conversationId: string;
  sender: 'guest' | 'host' | 'system' | 'ai';
  content: string;
  timestamp: Date;
  status: MessageStatus;
  channel: MessageChannel;
  sentiment?: Sentiment;
  aiGenerated?: boolean;
  attachments?: Attachment[];
  readAt?: Date;
}

interface Conversation {
  id: string;
  guestId: string;
  guestName: string;
  guestAvatar?: string;
  guestPhone: string;
  guestEmail: string;
  propertyId: string;
  propertyName: string;
  checkIn: Date;
  checkOut: Date;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  sentiment: Sentiment;
  isPinned: boolean;
  isArchived: boolean;
  tags: string[];
  messages: Message[];
}

interface AutomatedFlow {
  id: string;
  name: string;
  description: string;
  trigger: FlowTrigger;
  isActive: boolean;
  messagesSent: number;
  openRate: number;
  steps: FlowStep[];
}

interface FlowStep {
  id: string;
  type: 'message' | 'delay' | 'condition';
  channel?: MessageChannel;
  content?: string;
  delay?: { value: number; unit: 'minutes' | 'hours' | 'days' };
  condition?: { field: string; operator: string; value: string };
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  channel: MessageChannel;
  subject?: string;
  content: string;
  variables: string[];
  useCount: number;
  lastUsed?: Date;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

type MessageStatus = 'draft' | 'pending' | 'approved' | 'scheduled' | 'sent' | 'delivered' | 'read' | 'failed';
type MessageChannel = 'email' | 'sms' | 'whatsapp' | 'push';
type Sentiment = 'positive' | 'neutral' | 'negative';
type FlowTrigger = 'booking_confirmed' | 'check_in_24h' | 'check_in' | 'check_out_24h' | 'check_out' | 'review_request';
type TabView = 'inbox' | 'pending' | 'scheduled' | 'templates' | 'flows' | 'analytics';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockConversations: Conversation[] = [];

const mockAutomatedFlows: AutomatedFlow[] = [];

const mockTemplates: MessageTemplate[] = [];

// ============================================================================
// CONFIG
// ============================================================================

const channelConfig: Record<MessageChannel, { icon: any; label: string; color: string; bg: string }> = {
  email: { icon: Mail, label: 'Email', color: 'text-blue-600', bg: 'bg-blue-100' },
  sms: { icon: Phone, label: 'SMS', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', color: 'text-green-600', bg: 'bg-green-100' },
  push: { icon: Bell, label: 'Push', color: 'text-purple-600', bg: 'bg-purple-100' },
};

const sentimentConfig: Record<Sentiment, { icon: any; color: string; bg: string; label: string }> = {
  positive: { icon: Smile, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Positive' },
  neutral: { icon: Meh, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Neutral' },
  negative: { icon: Frown, color: 'text-red-600', bg: 'bg-red-100', label: 'Urgent' },
};

const triggerLabels: Record<FlowTrigger, string> = {
  booking_confirmed: 'Booking Confirmed',
  check_in_24h: '24 Hours Before Check-in',
  check_in: 'At Check-in',
  check_out_24h: '24 Hours Before Check-out',
  check_out: 'After Check-out',
  review_request: '3 Days After Check-out',
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Conversation List Item
function ConversationItem({
  conversation,
  isSelected,
  onClick
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const SentimentIcon = sentimentConfig[conversation.sentiment].icon;

  return (
    <motion.div
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={`flex items-start gap-3 p-4 cursor-pointer transition-colors border-b border-[#2D2D2D]/5 ${
        isSelected ? 'bg-[#500000]/5 border-l-2 border-l-[#500000]' : 'hover:bg-[#F5F5F0]'
      }`}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-semibold">
          {conversation.guestName.split(' ').map(n => n[0]).join('')}
        </div>
        {conversation.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#500000] text-white text-xs font-bold rounded-full flex items-center justify-center">
            {conversation.unreadCount}
          </span>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${sentimentConfig[conversation.sentiment].bg} flex items-center justify-center`}>
          <SentimentIcon className={`w-2.5 h-2.5 ${sentimentConfig[conversation.sentiment].color}`} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${conversation.unreadCount > 0 ? 'text-[#2D2D2D]' : 'text-[#2D2D2D]/80'}`}>
              {conversation.guestName}
            </span>
            {conversation.isPinned && <Pin className="w-3 h-3 text-[#C4A777]" />}
          </div>
          <span className="text-xs text-[#2D2D2D]/50">
            {formatTimeAgo(conversation.lastMessageTime)}
          </span>
        </div>

        <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'text-[#2D2D2D] font-medium' : 'text-[#2D2D2D]/60'}`}>
          {conversation.lastMessage}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-[#2D2D2D]/50 flex items-center gap-1">
            <Home className="w-3 h-3" />
            {conversation.propertyName}
          </span>
          {conversation.tags.map(tag => (
            <span
              key={tag}
              className={`px-1.5 py-0.5 text-xs rounded ${
                tag === 'Issue' ? 'bg-red-100 text-red-600' :
                tag === 'VIP' ? 'bg-[#C4A777]/20 text-[#C4A777]' :
                'bg-[#F5F5F0] text-[#2D2D2D]/60'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Message Bubble
function MessageBubble({ message }: { message: Message }) {
  const isGuest = message.sender === 'guest';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="px-3 py-1.5 bg-[#F5F5F0] text-[#2D2D2D]/60 text-xs rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isGuest ? 'justify-start' : 'justify-end'} mb-3`}
    >
      <div className={`max-w-[75%] ${isGuest ? '' : 'text-right'}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-2.5 ${
            isGuest
              ? 'bg-white border border-[#2D2D2D]/10 text-[#2D2D2D]'
              : 'bg-[#500000] text-white'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className={`flex items-center gap-2 mt-1 text-xs text-[#2D2D2D]/40 ${isGuest ? '' : 'justify-end'}`}>
          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {message.aiGenerated && (
            <span className="flex items-center gap-0.5 text-purple-500">
              <Sparkles className="w-3 h-3" />
              AI
            </span>
          )}
          {!isGuest && message.status === 'read' && (
            <Check className="w-3 h-3 text-emerald-500" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Compose Modal
function ComposeModal({
  isOpen,
  onClose,
  templates,
  onSend
}: {
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  onSend: (message: { channel: MessageChannel; content: string; recipient?: string }) => void;
}) {
  const [channel, setChannel] = useState<MessageChannel>('sms');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleTemplateSelect = (template: MessageTemplate) => {
    setChannel(template.channel);
    setContent(template.content);
    setSelectedTemplate(template.id);
  };

  const handleAiGenerate = async () => {
    setIsAiGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setContent('Hi there! I hope you\'re enjoying your stay at Right at Home BnB. Just checking in to see if everything is going well. Let me know if you need anything at all!\n\nBest,\nSteven');
    setIsAiGenerating(false);
    toast.success('AI message generated!');
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#2D2D2D]/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-['Playfair_Display'] font-semibold text-[#500000]">
              New Message
            </h2>
            <button onClick={onClose} className="p-2 text-[#2D2D2D]/60 hover:text-[#500000]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Channel Selection */}
          <div>
            <label className="text-sm font-medium text-[#2D2D2D]/70 mb-2 block">Channel</label>
            <div className="flex gap-2">
              {Object.entries(channelConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setChannel(key as MessageChannel)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      channel === key
                        ? 'border-[#500000] bg-[#500000]/5 text-[#500000]'
                        : 'border-[#2D2D2D]/10 hover:border-[#500000]/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Templates */}
          <div>
            <label className="text-sm font-medium text-[#2D2D2D]/70 mb-2 block">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {templates.filter(t => t.channel === channel).slice(0, 4).map(template => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-[#500000] bg-[#500000]/5 text-[#500000]'
                      : 'border-[#2D2D2D]/10 hover:border-[#500000]/30'
                  }`}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* Message Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#2D2D2D]/70">Message</label>
              <button
                onClick={handleAiGenerate}
                disabled={isAiGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
              >
                {isAiGenerating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isAiGenerating ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 resize-none"
              placeholder="Type your message..."
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[#2D2D2D]/40">
                {content.length} characters
              </span>
              <span className="text-xs text-[#2D2D2D]/40">
                Variables: {'{'}{'{'} guest_name {'}'}{'}'},  {'{'}{'{'} property_name {'}'}{'}'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[#2D2D2D]/10 flex items-center justify-between">
          <button className="flex items-center gap-2 px-4 py-2 text-[#2D2D2D]/60 hover:text-[#500000] transition-colors">
            <Calendar className="w-4 h-4" />
            Schedule
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#2D2D2D]/60 hover:text-[#500000] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSend({ channel, content });
                onClose();
              }}
              disabled={!content.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send Now
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Flow Card
function FlowCard({ flow, onToggle }: { flow: AutomatedFlow; onToggle: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl p-5 border border-[#2D2D2D]/5 hover:border-[#500000]/20 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${flow.isActive ? 'bg-emerald-100' : 'bg-gray-100'} flex items-center justify-center`}>
            <Zap className={`w-5 h-5 ${flow.isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-[#2D2D2D]">{flow.name}</h3>
            <p className="text-sm text-[#2D2D2D]/60">{triggerLabels[flow.trigger]}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            flow.isActive ? 'bg-emerald-500' : 'bg-gray-200'
          }`}
        >
          <motion.div
            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
            animate={{ left: flow.isActive ? 28 : 4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      <p className="text-sm text-[#2D2D2D]/70 mb-4">{flow.description}</p>

      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-[#2D2D2D]/60">
          <Send className="w-3.5 h-3.5" />
          {flow.messagesSent} sent
        </span>
        <span className="flex items-center gap-1 text-emerald-600">
          <Eye className="w-3.5 h-3.5" />
          {(flow.openRate * 100).toFixed(0)}% open rate
        </span>
        <span className="flex items-center gap-1 text-[#2D2D2D]/60">
          {flow.steps.length} steps
        </span>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#2D2D2D]/5">
        <button className="flex-1 flex items-center justify-center gap-2 py-2 text-[#500000] bg-[#500000]/5 rounded-lg hover:bg-[#500000]/10 transition-colors text-sm font-medium">
          <Edit className="w-4 h-4" />
          Edit Flow
        </button>
        <button className="p-2 text-[#2D2D2D]/40 hover:text-[#500000] transition-colors">
          <BarChart3 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// Analytics View
function AnalyticsView() {
  const stats = [
    { label: 'Total Messages', value: '1,247', change: '+12%', isPositive: true },
    { label: 'Response Rate', value: '94%', change: '+3%', isPositive: true },
    { label: 'Avg Response Time', value: '8 min', change: '-2 min', isPositive: true },
    { label: 'Sentiment Score', value: '4.6/5', change: '+0.2', isPositive: true },
  ];

  const channelStats = [
    { channel: 'sms', count: 567, percentage: 45 },
    { channel: 'email', count: 432, percentage: 35 },
    { channel: 'whatsapp', count: 186, percentage: 15 },
    { channel: 'push', count: 62, percentage: 5 },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white rounded-xl p-5 border border-[#2D2D2D]/5"
          >
            <div className="text-sm text-[#2D2D2D]/60 mb-1">{stat.label}</div>
            <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D] mb-1">
              {stat.value}
            </div>
            <div className={`text-sm ${stat.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
              {stat.change}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Channel Distribution */}
      <div className="bg-white rounded-xl p-6 border border-[#2D2D2D]/5">
        <h3 className="font-semibold text-[#2D2D2D] mb-4">Messages by Channel</h3>
        <div className="space-y-4">
          {channelStats.map(stat => {
            const config = channelConfig[stat.channel as MessageChannel];
            const Icon = config.icon;
            return (
              <div key={stat.channel} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[#2D2D2D]">{config.label}</span>
                    <span className="text-sm text-[#2D2D2D]/60">{stat.count} ({stat.percentage}%)</span>
                  </div>
                  <div className="w-full h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.percentage}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="h-full bg-[#500000] rounded-full"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sentiment Breakdown */}
      <div className="bg-white rounded-xl p-6 border border-[#2D2D2D]/5">
        <h3 className="font-semibold text-[#2D2D2D] mb-4">Guest Sentiment</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(sentimentConfig).map(([key, config]) => {
            const Icon = config.icon;
            const percentage = key === 'positive' ? 72 : key === 'neutral' ? 23 : 5;
            return (
              <div key={key} className={`p-4 rounded-xl ${config.bg}`}>
                <Icon className={`w-6 h-6 ${config.color} mb-2`} />
                <div className="text-2xl font-bold text-[#2D2D2D]">{percentage}%</div>
                <div className="text-sm text-[#2D2D2D]/60">{config.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Helper function
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<TabView>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState(mockConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [flows, setFlows] = useState(mockAutomatedFlows);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter(c => !c.isArchived);

    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.propertyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort: pinned first, then by last message time
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });
  }, [conversations, searchQuery]);

  // Pending approval count
  const pendingCount = useMemo(() =>
    conversations.filter(c => c.messages.some(m => m.status === 'pending')).length
  , [conversations]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCompose(false);
        setSelectedConversation(null);
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setShowCompose(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  // Handle send reply
  const handleSendReply = useCallback(() => {
    if (!replyText.trim() || !selectedConversation) return;

    const newMessage: Message = {
      id: `m${Date.now()}`,
      conversationId: selectedConversation.id,
      sender: 'host',
      content: replyText,
      timestamp: new Date(),
      status: 'sent',
      channel: 'sms',
    };

    setConversations(prev =>
      prev.map(c =>
        c.id === selectedConversation.id
          ? { ...c, messages: [...c.messages, newMessage], lastMessage: replyText, lastMessageTime: new Date() }
          : c
      )
    );

    setSelectedConversation(prev =>
      prev ? { ...prev, messages: [...prev.messages, newMessage] } : null
    );

    setReplyText('');
    toast.success('Message sent!');
  }, [replyText, selectedConversation]);

  // Toggle flow
  const handleToggleFlow = useCallback((flowId: string) => {
    setFlows(prev =>
      prev.map(f =>
        f.id === flowId ? { ...f, isActive: !f.isActive } : f
      )
    );
    toast.success('Flow updated');
  }, []);

  // Stats
  const stats = [
    { label: 'Unread', value: conversations.reduce((sum, c) => sum + c.unreadCount, 0), icon: MessageCircle, color: 'text-[#500000]' },
    { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-amber-600' },
    { label: 'Sent Today', value: 12, icon: Send, color: 'text-emerald-600' },
    { label: 'AI Generated', value: 45, icon: Sparkles, color: 'text-purple-600' },
  ];

  return (
    <DashboardShell>
    <div className="min-h-screen bg-[#F5F5F0]">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                Message Hub
              </h1>
              <p className="text-[#2D2D2D]/60 mt-1">
                {filteredConversations.length} conversations
              </p>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCompose(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20"
              >
                <Edit className="w-5 h-5" />
                New Message
              </motion.button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl"
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <div className="text-lg font-bold text-[#2D2D2D]">{stat.value}</div>
                  <div className="text-xs text-[#2D2D2D]/60">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-[#F5F5F0] rounded-xl p-1">
            {[
              { id: 'inbox', label: 'Inbox', icon: MessageCircle },
              { id: 'pending', label: 'Pending', icon: Clock, badge: pendingCount },
              { id: 'scheduled', label: 'Scheduled', icon: Calendar },
              { id: 'templates', label: 'Templates', icon: FileText },
              { id: 'flows', label: 'Flows', icon: Zap },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabView)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-[#500000] shadow-sm'
                    : 'text-[#2D2D2D]/60 hover:text-[#500000]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Inbox View */}
        {activeTab === 'inbox' && (
          <div className="flex gap-6 h-[calc(100vh-280px)]">
            {/* Conversation List */}
            <div className="w-96 bg-white rounded-2xl border border-[#2D2D2D]/5 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[#2D2D2D]/5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D2D2D]/40" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F0] border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredConversations.map(conversation => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversation?.id === conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                  />
                ))}
              </div>
            </div>

            {/* Conversation Detail */}
            {selectedConversation ? (
              <div className="flex-1 bg-white rounded-2xl border border-[#2D2D2D]/5 overflow-hidden flex flex-col">
                {/* Conversation Header */}
                <div className="p-4 border-b border-[#2D2D2D]/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-semibold">
                      {selectedConversation.guestName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#2D2D2D]">{selectedConversation.guestName}</h3>
                      <p className="text-sm text-[#2D2D2D]/60">
                        {selectedConversation.propertyName} | {selectedConversation.checkIn.toLocaleDateString()} - {selectedConversation.checkOut.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-[#2D2D2D]/60 hover:text-[#500000] transition-colors">
                      <Phone className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-[#2D2D2D]/60 hover:text-[#500000] transition-colors">
                      <Mail className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-[#2D2D2D]/60 hover:text-[#500000] transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#F5F5F0]/50">
                  {selectedConversation.messages.map(message => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Input */}
                <div className="p-4 border-t border-[#2D2D2D]/5">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        rows={1}
                        placeholder="Type a message..."
                        className="w-full px-4 py-3 bg-[#F5F5F0] border-0 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#500000]/20"
                      />
                    </div>
                    <button
                      onClick={handleSendReply}
                      disabled={!replyText.trim()}
                      className="p-3 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <button className="flex items-center gap-1.5 text-sm text-[#2D2D2D]/60 hover:text-[#500000] transition-colors">
                      <Sparkles className="w-4 h-4" />
                      AI Suggest
                    </button>
                    <button className="flex items-center gap-1.5 text-sm text-[#2D2D2D]/60 hover:text-[#500000] transition-colors">
                      <FileText className="w-4 h-4" />
                      Templates
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-white rounded-2xl border border-[#2D2D2D]/5 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
                  <h3 className="text-lg font-['Playfair_Display'] text-[#2D2D2D]/60">Select a conversation</h3>
                  <p className="text-sm text-[#2D2D2D]/40 mt-1">Choose a guest to view messages</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Templates View */}
        {activeTab === 'templates' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockTemplates.map((template, idx) => {
              const channel = channelConfig[template.channel];
              const ChannelIcon = channel.icon;

              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-xl p-5 border border-[#2D2D2D]/5 hover:border-[#500000]/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg ${channel.bg} flex items-center justify-center`}>
                      <ChannelIcon className={`w-5 h-5 ${channel.color}`} />
                    </div>
                    <span className="px-2 py-1 bg-[#F5F5F0] text-[#2D2D2D]/60 rounded-lg text-xs">
                      {template.category}
                    </span>
                  </div>

                  <h3 className="font-semibold text-[#2D2D2D] mb-2">{template.name}</h3>
                  <p className="text-sm text-[#2D2D2D]/60 line-clamp-2 mb-3">{template.content}</p>

                  <div className="flex items-center gap-3 text-xs text-[#2D2D2D]/50 mb-4">
                    <span>Used {template.useCount}x</span>
                    {template.lastUsed && (
                      <span>Last: {formatTimeAgo(template.lastUsed)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="flex-1 py-2 bg-[#500000]/5 text-[#500000] rounded-lg text-sm font-medium hover:bg-[#500000]/10 transition-colors">
                      Use Template
                    </button>
                    <button className="p-2 text-[#2D2D2D]/40 hover:text-[#500000] transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Add New Template */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: mockTemplates.length * 0.05 }}
              className="bg-[#F5F5F0] rounded-xl p-5 border-2 border-dashed border-[#2D2D2D]/20 flex items-center justify-center hover:border-[#500000]/40 transition-colors min-h-[200px]"
            >
              <div className="text-center">
                <Plus className="w-8 h-8 text-[#500000]/40 mx-auto mb-2" />
                <span className="text-[#2D2D2D]/60 font-medium">Create Template</span>
              </div>
            </motion.button>
          </div>
        )}

        {/* Flows View */}
        {activeTab === 'flows' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map((flow, idx) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                onToggle={() => handleToggleFlow(flow.id)}
              />
            ))}

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: flows.length * 0.05 }}
              className="bg-[#F5F5F0] rounded-xl p-5 border-2 border-dashed border-[#2D2D2D]/20 flex items-center justify-center hover:border-[#500000]/40 transition-colors min-h-[200px]"
            >
              <div className="text-center">
                <Plus className="w-8 h-8 text-[#500000]/40 mx-auto mb-2" />
                <span className="text-[#2D2D2D]/60 font-medium">Create Flow</span>
              </div>
            </motion.button>
          </div>
        )}

        {/* Analytics View */}
        {activeTab === 'analytics' && <AnalyticsView />}

        {/* Pending View */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingCount === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">All caught up!</h3>
                <p className="text-[#2D2D2D]/60 mt-2">No messages pending approval</p>
              </div>
            ) : (
              <p className="text-[#2D2D2D]/60">Pending messages would appear here</p>
            )}
          </div>
        )}

        {/* Scheduled View */}
        {activeTab === 'scheduled' && (
          <div className="text-center py-16 bg-white rounded-2xl">
            <Calendar className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
            <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">No scheduled messages</h3>
            <p className="text-[#2D2D2D]/60 mt-2">Schedule messages to send later</p>
            <button
              onClick={() => setShowCompose(true)}
              className="mt-4 px-5 py-2.5 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors"
            >
              Schedule Message
            </button>
          </div>
        )}
      </main>

      {/* Compose Modal */}
      <AnimatePresence>
        {showCompose && (
          <ComposeModal
            isOpen={showCompose}
            onClose={() => setShowCompose(false)}
            templates={mockTemplates}
            onSend={(msg) => {
              toast.success(`Message sent via ${msg.channel}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </DashboardShell>
  );
}
