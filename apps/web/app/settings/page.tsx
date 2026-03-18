'use client';

/**
 * Right at Home BnB - Settings Page
 * Comprehensive Settings: Profile, Integrations, Security, AI, Billing
 * @author ECHO OMEGA PRIME
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import {
  Settings, Phone, PhoneOff, PhoneCall, PhoneIncoming, PhoneForwarded,
  Moon, Sun, Clock, Shield, Bell, BellOff, AlertTriangle, CheckCircle,
  ChevronLeft, ChevronRight, Save, RotateCcw, Sparkles, Bot, User,
  Calendar, Volume2, VolumeX, MessageSquare, Zap, ToggleLeft, ToggleRight,
  Building2, CreditCard, Users, Key, Lock, Eye, EyeOff, Trash2, Plus,
  Download, Upload, Database, Globe, Smartphone, Mail, Camera, Edit2,
  LogOut, History, Monitor, Palette, Home, Link2, ExternalLink, Copy,
  RefreshCw, AlertCircle, Info, HelpCircle, Wifi, X, Check, QrCode,
  Fingerprint, ShieldCheck, ShieldAlert, UserPlus, Crown, Star
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type TabView = 'profile' | 'integrations' | 'ai' | 'notifications' | 'security' | 'billing' | 'team' | 'data';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  businessName: string;
  businessAddress: string;
  city: string;
  state: string;
  zip: string;
  timezone: string;
  language: string;
  currency: string;
  dateFormat: string;
}

interface Integration {
  id: string;
  name: string;
  type: 'booking' | 'smart_home' | 'communication' | 'payment' | 'other';
  icon: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync?: Date;
  apiKey?: string;
  settings?: Record<string, any>;
  properties?: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'cleaner';
  avatar: string;
  status: 'active' | 'pending' | 'inactive';
  lastActive?: Date;
  permissions: string[];
}

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: Date;
  isCurrent: boolean;
}

interface CallRoutingSettings {
  aiCallsEnabled: boolean;
  availabilityMode: 'always' | 'scheduled' | 'manual';
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  emergencyBypass: boolean;
  emergencyKeywords: string[];
  voicemailEnabled: boolean;
  callForwardNumber: string;
  maxRingsBeforeAI: number;
  aiGreeting: string;
  notifyOnAICall: boolean;
  callTranscriptionEnabled: boolean;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  bookingAlerts: boolean;
  messageAlerts: boolean;
  paymentAlerts: boolean;
  maintenanceAlerts: boolean;
  reviewAlerts: boolean;
  digestFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
}

interface BillingInfo {
  plan: 'starter' | 'professional' | 'enterprise';
  billingCycle: 'monthly' | 'annual';
  nextBillingDate: Date;
  paymentMethod: {
    type: 'card' | 'bank';
    last4: string;
    brand?: string;
    expiry?: string;
  };
  invoices: {
    id: string;
    date: Date;
    amount: number;
    status: 'paid' | 'pending' | 'failed';
  }[];
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_PROFILE: UserProfile = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  avatarUrl: '',
  businessName: '',
  businessAddress: '',
  city: '',
  state: '',
  zip: '',
  timezone: 'America/Chicago',
  language: 'en',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
};

const MOCK_INTEGRATIONS: Integration[] = [
  { id: 'airbnb', name: 'Airbnb', type: 'booking', icon: '🏠', status: 'disconnected', properties: 0 },
  { id: 'vrbo', name: 'VRBO', type: 'booking', icon: '🏡', status: 'disconnected', properties: 0 },
  { id: 'booking', name: 'Booking.com', type: 'booking', icon: '🌐', status: 'disconnected', properties: 0 },
  { id: 'august', name: 'August Smart Locks', type: 'smart_home', icon: '🔐', status: 'disconnected' },
  { id: 'schlage', name: 'Schlage Encode', type: 'smart_home', icon: '🔑', status: 'disconnected' },
  { id: 'nest', name: 'Google Nest', type: 'smart_home', icon: '🌡️', status: 'disconnected' },
  { id: 'ring', name: 'Ring Doorbell', type: 'smart_home', icon: '🚪', status: 'disconnected' },
  { id: 'twilio', name: 'Twilio', type: 'communication', icon: '📱', status: 'disconnected' },
  { id: 'sendgrid', name: 'SendGrid', type: 'communication', icon: '📧', status: 'disconnected' },
  { id: 'stripe', name: 'Stripe', type: 'payment', icon: '💳', status: 'disconnected' },
  { id: 'quickbooks', name: 'QuickBooks', type: 'payment', icon: '📊', status: 'disconnected' },
];

const MOCK_TEAM: TeamMember[] = [];

const MOCK_SESSIONS: Session[] = [
  {
    id: 'sess-1',
    device: 'Windows Desktop',
    browser: 'Chrome 120',
    location: 'Midland, TX',
    ip: '192.168.1.100',
    lastActive: new Date(),
    isCurrent: true,
  },
  {
    id: 'sess-2',
    device: 'iPhone 15 Pro',
    browser: 'Safari Mobile',
    location: 'Midland, TX',
    ip: '192.168.1.150',
    lastActive: new Date(Date.now() - 30 * 60 * 1000),
    isCurrent: false,
  },
  {
    id: 'sess-3',
    device: 'MacBook Pro',
    browser: 'Safari 17',
    location: 'Dallas, TX',
    ip: '45.32.180.22',
    lastActive: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
];

const MOCK_BILLING: BillingInfo = {
  plan: 'professional',
  billingCycle: 'monthly',
  nextBillingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  paymentMethod: {
    type: 'card',
    last4: '4242',
    brand: 'Visa',
    expiry: '12/26',
  },
  invoices: [
    { id: 'inv-1', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), amount: 99, status: 'paid' },
    { id: 'inv-2', date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), amount: 99, status: 'paid' },
    { id: 'inv-3', date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), amount: 99, status: 'paid' },
  ],
};

const DEFAULT_CALL_SETTINGS: CallRoutingSettings = {
  aiCallsEnabled: true,
  availabilityMode: 'scheduled',
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  emergencyBypass: true,
  emergencyKeywords: ['emergency', 'urgent', 'help', 'fire', 'flood', 'locked out', 'police'],
  voicemailEnabled: true,
  callForwardNumber: '(432) 559-1904',
  maxRingsBeforeAI: 4,
  aiGreeting: "Hello! You've reached Right at Home BnB. I'm the AI concierge assistant. How can I help you today?",
  notifyOnAICall: true,
  callTranscriptionEnabled: true,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  bookingAlerts: true,
  messageAlerts: true,
  paymentAlerts: true,
  maintenanceAlerts: true,
  reviewAlerts: true,
  digestFrequency: 'realtime',
  quietHours: true,
  quietStart: '22:00',
  quietEnd: '07:00',
};

const TIMEZONES = [
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
];

const PLANS = {
  starter: { name: 'Starter', price: 29, properties: 5, features: ['Basic analytics', 'Email support', '1 team member'] },
  professional: { name: 'Professional', price: 99, properties: 25, features: ['Advanced analytics', 'Priority support', '10 team members', 'AI concierge', 'Smart lock integration'] },
  enterprise: { name: 'Enterprise', price: 299, properties: 'Unlimited', features: ['Custom analytics', '24/7 phone support', 'Unlimited team', 'White-label option', 'API access', 'Dedicated account manager'] },
};

// ============================================================================
// COMPONENTS
// ============================================================================

function LoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#2D2D2D]/10 rounded-xl ${className}`} />
  );
}

function SettingsCard({
  title,
  description,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden"
    >
      <div className="p-4 border-b border-[#2D2D2D]/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#500000]/10 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-[#500000]" />
          </div>
          <div>
            <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-[#2D2D2D]/60">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

function ToggleOption({
  enabled,
  onChange,
  label,
  description,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <div className="font-medium text-[#2D2D2D]">{label}</div>
        {description && <div className="text-sm text-[#2D2D2D]/60">{description}</div>}
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className="relative w-14 h-8 rounded-full transition-colors duration-300"
        style={{ backgroundColor: enabled ? '#500000' : '#E5E5E5' }}
      >
        <motion.div
          animate={{ x: enabled ? 26 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
        />
      </button>
    </div>
  );
}

function IntegrationCard({ integration, onConnect, onDisconnect, onSync }: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);

  const statusColors = {
    connected: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    disconnected: 'bg-gray-100 text-gray-600 border-gray-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl border border-[#2D2D2D]/10 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{integration.icon}</span>
          <div>
            <h4 className="font-semibold text-[#2D2D2D]">{integration.name}</h4>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[integration.status]}`}>
              {integration.status === 'connected' && <CheckCircle className="w-3 h-3 mr-1" />}
              {integration.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
              {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
            </span>
          </div>
        </div>

        {integration.status === 'connected' ? (
          <div className="flex gap-2">
            <button
              onClick={onSync}
              className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
              title="Sync now"
            >
              <RefreshCw className="w-4 h-4 text-[#2D2D2D]/60" />
            </button>
            <button
              onClick={onDisconnect}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="Disconnect"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="px-3 py-1.5 bg-[#500000] text-white text-sm font-medium rounded-lg hover:bg-[#500000]/90 transition-colors"
          >
            Connect
          </button>
        )}
      </div>

      {integration.status === 'connected' && (
        <div className="space-y-2 text-sm">
          {integration.lastSync && (
            <div className="flex items-center gap-2 text-[#2D2D2D]/60">
              <RefreshCw className="w-3.5 h-3.5" />
              Last synced {formatTimeAgo(integration.lastSync)}
            </div>
          )}
          {integration.properties !== undefined && integration.properties > 0 && (
            <div className="flex items-center gap-2 text-[#2D2D2D]/60">
              <Building2 className="w-3.5 h-3.5" />
              {integration.properties} properties synced
            </div>
          )}
          {integration.apiKey && (
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-[#2D2D2D]/60" />
              <code className="bg-[#F5F5F0] px-2 py-0.5 rounded text-xs">
                {showApiKey ? integration.apiKey : '••••••••••••'}
              </code>
              <button onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}

      {integration.status === 'error' && (
        <div className="mt-2 p-2 bg-red-50 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Connection error. Please reconnect or check your credentials.</span>
        </div>
      )}
    </motion.div>
  );
}

function TeamMemberCard({ member, onEdit, onRemove, onResend }: {
  member: TeamMember;
  onEdit: () => void;
  onRemove: () => void;
  onResend: () => void;
}) {
  const roleColors = {
    owner: 'bg-[#C4A777]/20 text-[#8B6914] border-[#C4A777]',
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
    manager: 'bg-blue-100 text-blue-700 border-blue-200',
    cleaner: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  const roleIcons = {
    owner: Crown,
    admin: ShieldCheck,
    manager: Users,
    cleaner: Sparkles,
  };

  const RoleIcon = roleIcons[member.role];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-[#2D2D2D]/10 p-4 flex items-center gap-4"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-semibold">
        {member.avatar}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-[#2D2D2D] truncate">{member.name}</h4>
          {member.status === 'pending' && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
              Pending
            </span>
          )}
        </div>
        <p className="text-sm text-[#2D2D2D]/60 truncate">{member.email}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${roleColors[member.role]}`}>
            <RoleIcon className="w-3 h-3 mr-1" />
            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
          </span>
          {member.lastActive && (
            <span className="text-xs text-[#2D2D2D]/40">
              Active {formatTimeAgo(member.lastActive)}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1">
        {member.status === 'pending' ? (
          <button
            onClick={onResend}
            className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
            title="Resend invite"
          >
            <Mail className="w-4 h-4 text-[#500000]" />
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
            title="Edit permissions"
          >
            <Edit2 className="w-4 h-4 text-[#2D2D2D]/60" />
          </button>
        )}
        {member.role !== 'owner' && (
          <button
            onClick={onRemove}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
            title="Remove member"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function SessionCard({ session, onRevoke }: {
  session: Session;
  onRevoke: () => void;
}) {
  const deviceIcons: Record<string, React.ElementType> = {
    'Windows Desktop': Monitor,
    'MacBook Pro': Monitor,
    'iPhone': Smartphone,
    'iPad': Smartphone,
    'Android': Smartphone,
  };

  const DeviceIcon = Object.entries(deviceIcons).find(([key]) =>
    session.device.toLowerCase().includes(key.toLowerCase())
  )?.[1] || Monitor;

  return (
    <div className="flex items-center gap-4 p-4 bg-[#F5F5F0] rounded-xl">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        session.isCurrent ? 'bg-emerald-100' : 'bg-[#2D2D2D]/10'
      }`}>
        <DeviceIcon className={`w-5 h-5 ${session.isCurrent ? 'text-emerald-600' : 'text-[#2D2D2D]/60'}`} />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#2D2D2D]">{session.device}</span>
          {session.isCurrent && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
              Current
            </span>
          )}
        </div>
        <p className="text-sm text-[#2D2D2D]/60">
          {session.browser} &middot; {session.location}
        </p>
        <p className="text-xs text-[#2D2D2D]/40">
          {formatTimeAgo(session.lastActive)} &middot; {session.ip}
        </p>
      </div>

      {!session.isCurrent && (
        <button
          onClick={onRevoke}
          className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
        >
          Revoke
        </button>
      )}
    </div>
  );
}

function InviteTeamModal({ isOpen, onClose, onInvite }: {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: TeamMember['role']) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMember['role']>('manager');

  const handleSubmit = () => {
    if (email) {
      onInvite(email, role);
      setEmail('');
      setRole('manager');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl max-w-md w-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-['Playfair_Display'] font-bold text-[#500000]">
            Invite Team Member
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2D2D2D] mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="team@example.com"
              className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2D2D2D] mb-1">
              Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'manager', 'cleaner'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    role === r
                      ? 'bg-[#500000] text-white'
                      : 'bg-[#F5F5F0] text-[#2D2D2D] hover:bg-[#500000]/10'
                  }`}
                >
                  <span className="text-sm font-medium capitalize">{r}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-[#F5F5F0] rounded-xl">
            <p className="text-sm text-[#2D2D2D]/60">
              {role === 'admin' && 'Full access to all features except billing'}
              {role === 'manager' && 'Can manage properties, guests, and cleaning'}
              {role === 'cleaner' && 'Can view and update cleaning assignments only'}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-[#F5F5F0] text-[#2D2D2D] font-medium rounded-xl hover:bg-[#2D2D2D]/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!email}
            className="flex-1 px-4 py-3 bg-[#500000] text-white font-medium rounded-xl hover:bg-[#500000]/90 transition-colors disabled:opacity-50"
          >
            Send Invite
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ConnectIntegrationModal({ isOpen, onClose, integration, onSubmit }: {
  isOpen: boolean;
  onClose: () => void;
  integration: Integration | null;
  onSubmit: (apiKey: string) => void;
}) {
  const [apiKey, setApiKey] = useState('');

  if (!isOpen || !integration) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl max-w-md w-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{integration.icon}</span>
            <h3 className="text-xl font-['Playfair_Display'] font-bold text-[#500000]">
              Connect {integration.name}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2D2D2D] mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
              className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none font-mono"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-xl flex gap-2">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              You can find your API key in your {integration.name} account settings under Developer or API section.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-[#F5F5F0] text-[#2D2D2D] font-medium rounded-xl hover:bg-[#2D2D2D]/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit(apiKey);
              setApiKey('');
              onClose();
            }}
            disabled={!apiKey}
            className="flex-1 px-4 py-3 bg-[#500000] text-white font-medium rounded-xl hover:bg-[#500000]/90 transition-colors disabled:opacity-50"
          >
            Connect
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsPage() {
  // State
  const [activeTab, setActiveTab] = useState<TabView>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Profile state
  const [profile, setProfile] = useState<UserProfile>(MOCK_PROFILE);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Integrations state
  const [integrations, setIntegrations] = useState<Integration[]>(MOCK_INTEGRATIONS);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Team state
  const [team, setTeam] = useState<TeamMember[]>(MOCK_TEAM);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // AI settings
  const [callSettings, setCallSettings] = useState<CallRoutingSettings>(DEFAULT_CALL_SETTINGS);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);

  // Security state
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Billing state
  const [billing, setBilling] = useState<BillingInfo>(MOCK_BILLING);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectModalOpen(false);
        setInviteModalOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulating API save
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Settings saved successfully!');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setProfile(prev => ({ ...prev, avatarUrl: url }));
      setHasChanges(true);
      toast.success('Avatar updated');
    }
  };

  const handleConnectIntegration = (integration: Integration) => {
    setSelectedIntegration(integration);
    setConnectModalOpen(true);
  };

  const handleDisconnectIntegration = (integrationId: string) => {
    setIntegrations(prev => prev.map(i =>
      i.id === integrationId ? { ...i, status: 'disconnected' as const } : i
    ));
    toast.success('Integration disconnected');
  };

  const handleSyncIntegration = (integrationId: string) => {
    setIntegrations(prev => prev.map(i =>
      i.id === integrationId ? { ...i, lastSync: new Date() } : i
    ));
    toast.success('Sync started');
  };

  const handleIntegrationConnect = (apiKey: string) => {
    if (selectedIntegration) {
      setIntegrations(prev => prev.map(i =>
        i.id === selectedIntegration.id
          ? { ...i, status: 'connected' as const, apiKey, lastSync: new Date() }
          : i
      ));
      toast.success(`${selectedIntegration.name} connected successfully!`);
    }
  };

  const handleInviteTeam = (email: string, role: TeamMember['role']) => {
    const newMember: TeamMember = {
      id: `tm-${Date.now()}`,
      name: email.split('@')[0],
      email,
      role,
      avatar: email.substring(0, 2).toUpperCase(),
      status: 'pending',
      permissions: role === 'admin' ? ['properties', 'guests', 'cleaning', 'messages']
                 : role === 'manager' ? ['properties', 'cleaning']
                 : ['cleaning'],
    };
    setTeam(prev => [...prev, newMember]);
    toast.success(`Invitation sent to ${email}`);
  };

  const handleRemoveTeamMember = (memberId: string) => {
    setTeam(prev => prev.filter(m => m.id !== memberId));
    toast.success('Team member removed');
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    toast.success('Session revoked');
  };

  // Get current availability status for AI calls
  const getAvailabilityStatus = useCallback(() => {
    if (!callSettings.aiCallsEnabled) return { status: 'manual', label: 'AI Calls Off', color: 'text-gray-500' };
    if (callSettings.availabilityMode === 'always') return { status: 'ai', label: 'AI Always On', color: 'text-purple-600' };
    if (callSettings.availabilityMode === 'manual') return { status: 'manual', label: 'Manual Mode', color: 'text-blue-600' };

    if (callSettings.quietHoursEnabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = callSettings.quietHoursStart.split(':').map(Number);
      const [endH, endM] = callSettings.quietHoursEnd.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const isQuietHours = startMinutes > endMinutes
        ? currentTime >= startMinutes || currentTime < endMinutes
        : currentTime >= startMinutes && currentTime < endMinutes;
      if (isQuietHours) return { status: 'ai', label: 'AI Handling (Quiet Hours)', color: 'text-purple-600' };
    }
    return { status: 'available', label: 'Steven Available', color: 'text-emerald-600' };
  }, [callSettings]);

  const availability = getAvailabilityStatus();

  // Filter integrations by type
  const integrationsByType = useMemo(() => ({
    booking: integrations.filter(i => i.type === 'booking'),
    smart_home: integrations.filter(i => i.type === 'smart_home'),
    communication: integrations.filter(i => i.type === 'communication'),
    payment: integrations.filter(i => i.type === 'payment'),
  }), [integrations]);

  const tabs: { id: TabView; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
    { id: 'ai', label: 'AI Settings', icon: Bot },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'data', label: 'Data', icon: Database },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <LoadingSkeleton className="h-16 w-64" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <LoadingSkeleton key={i} className="h-10 w-28" />
            ))}
          </div>
          <LoadingSkeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <button className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
                  <ChevronLeft className="w-5 h-5 text-[#2D2D2D]" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
                  Settings
                </h1>
                <p className="text-[#2D2D2D]/60 text-sm">
                  Manage your account and preferences
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* AI Status Badge */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-white border-2 ${
                availability.status === 'ai' ? 'border-purple-200 bg-purple-50' :
                availability.status === 'available' ? 'border-emerald-200 bg-emerald-50' :
                'border-gray-200'
              }`}>
                {availability.status === 'ai' ? (
                  <Bot className="w-4 h-4 text-purple-600" />
                ) : availability.status === 'available' ? (
                  <User className="w-4 h-4 text-emerald-600" />
                ) : (
                  <PhoneOff className="w-4 h-4 text-gray-500" />
                )}
                <span className={`text-sm font-medium ${availability.color}`}>
                  {availability.label}
                </span>
              </div>

              {/* Save Button */}
              {hasChanges && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#500000] text-white font-medium rounded-xl hover:bg-[#500000]/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </motion.button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-2 -mb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#500000] text-white shadow-lg shadow-[#500000]/20'
                    : 'text-[#2D2D2D]/60 hover:bg-[#500000]/10 hover:text-[#500000]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 pb-24">
        <AnimatePresence mode="wait">
          {/* ============================================================== */}
          {/* PROFILE TAB */}
          {/* ============================================================== */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Avatar & Basic Info */}
              <SettingsCard title="Personal Information" icon={User}>
                <div className="flex items-start gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        `${profile.firstName[0]}${profile.lastName[0]}`
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#500000] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#500000]/90 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">First Name</label>
                      <input
                        type="text"
                        value={profile.firstName}
                        onChange={(e) => handleProfileChange('firstName', e.target.value)}
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Last Name</label>
                      <input
                        type="text"
                        value={profile.lastName}
                        onChange={(e) => handleProfileChange('lastName', e.target.value)}
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Email</label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => handleProfileChange('email', e.target.value)}
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Phone</label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => handleProfileChange('phone', e.target.value)}
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </SettingsCard>

              {/* Business Information */}
              <SettingsCard title="Business Information" icon={Building2}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Business Name</label>
                    <input
                      type="text"
                      value={profile.businessName}
                      onChange={(e) => handleProfileChange('businessName', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Address</label>
                    <input
                      type="text"
                      value={profile.businessAddress}
                      onChange={(e) => handleProfileChange('businessAddress', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#2D2D2D] mb-1">City</label>
                    <input
                      type="text"
                      value={profile.city}
                      onChange={(e) => handleProfileChange('city', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="w-24">
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">State</label>
                      <input
                        type="text"
                        value={profile.state}
                        onChange={(e) => handleProfileChange('state', e.target.value)}
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">ZIP</label>
                      <input
                        type="text"
                        value={profile.zip}
                        onChange={(e) => handleProfileChange('zip', e.target.value)}
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </SettingsCard>

              {/* Preferences */}
              <SettingsCard title="Preferences" icon={Globe}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Timezone</label>
                    <select
                      value={profile.timezone}
                      onChange={(e) => handleProfileChange('timezone', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none appearance-none cursor-pointer"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Currency</label>
                    <select
                      value={profile.currency}
                      onChange={(e) => handleProfileChange('currency', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (&#8364;)</option>
                      <option value="GBP">GBP (&#163;)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Date Format</label>
                    <select
                      value={profile.dateFormat}
                      onChange={(e) => handleProfileChange('dateFormat', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Language</label>
                    <select
                      value={profile.language}
                      onChange={(e) => handleProfileChange('language', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="en">English</option>
                      <option value="es">Espa&#241;ol</option>
                    </select>
                  </div>
                </div>
              </SettingsCard>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* INTEGRATIONS TAB */}
          {/* ============================================================== */}
          {activeTab === 'integrations' && (
            <motion.div
              key="integrations"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Booking Platforms */}
              <SettingsCard
                title="Booking Platforms"
                description="Sync reservations from major platforms"
                icon={Calendar}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  {integrationsByType.booking.map((integration) => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      onConnect={() => handleConnectIntegration(integration)}
                      onDisconnect={() => handleDisconnectIntegration(integration.id)}
                      onSync={() => handleSyncIntegration(integration.id)}
                    />
                  ))}
                </div>
              </SettingsCard>

              {/* Smart Home */}
              <SettingsCard
                title="Smart Home Devices"
                description="Connect locks, thermostats, and cameras"
                icon={Home}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  {integrationsByType.smart_home.map((integration) => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      onConnect={() => handleConnectIntegration(integration)}
                      onDisconnect={() => handleDisconnectIntegration(integration.id)}
                      onSync={() => handleSyncIntegration(integration.id)}
                    />
                  ))}
                </div>
              </SettingsCard>

              {/* Communication */}
              <SettingsCard
                title="Communication"
                description="SMS, email, and messaging services"
                icon={MessageSquare}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  {integrationsByType.communication.map((integration) => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      onConnect={() => handleConnectIntegration(integration)}
                      onDisconnect={() => handleDisconnectIntegration(integration.id)}
                      onSync={() => handleSyncIntegration(integration.id)}
                    />
                  ))}
                </div>
              </SettingsCard>

              {/* Payments */}
              <SettingsCard
                title="Payment & Accounting"
                description="Process payments and sync with accounting"
                icon={CreditCard}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  {integrationsByType.payment.map((integration) => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      onConnect={() => handleConnectIntegration(integration)}
                      onDisconnect={() => handleDisconnectIntegration(integration.id)}
                      onSync={() => handleSyncIntegration(integration.id)}
                    />
                  ))}
                </div>
              </SettingsCard>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* AI SETTINGS TAB */}
          {/* ============================================================== */}
          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Master AI Toggle */}
              <div className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      {callSettings.aiCallsEnabled ? <Bot className="w-7 h-7" /> : <PhoneOff className="w-7 h-7" />}
                    </div>
                    <div>
                      <h2 className="text-xl font-['Playfair_Display'] font-semibold">AI Call Handling</h2>
                      <p className="text-white/70 text-sm mt-1">
                        {callSettings.aiCallsEnabled ? "AI will answer calls when you're unavailable" : 'All calls go directly to you'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCallSettings(prev => ({ ...prev, aiCallsEnabled: !prev.aiCallsEnabled }));
                      setHasChanges(true);
                    }}
                    className="relative w-16 h-9 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: callSettings.aiCallsEnabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' }}
                  >
                    <motion.div
                      animate={{ x: callSettings.aiCallsEnabled ? 28 : 4 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={`absolute top-1.5 w-6 h-6 rounded-full shadow-lg ${callSettings.aiCallsEnabled ? 'bg-white' : 'bg-white/60'}`}
                    />
                  </button>
                </div>

                {callSettings.aiCallsEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 pt-6 border-t border-white/20 grid grid-cols-3 gap-4"
                  >
                    <div className="text-center p-3 bg-white/10 rounded-xl">
                      <Phone className="w-5 h-5 mx-auto mb-2" />
                      <div className="text-2xl font-bold">24</div>
                      <div className="text-xs text-white/60">Calls Today</div>
                    </div>
                    <div className="text-center p-3 bg-white/10 rounded-xl">
                      <Bot className="w-5 h-5 mx-auto mb-2" />
                      <div className="text-2xl font-bold">18</div>
                      <div className="text-xs text-white/60">AI Handled</div>
                    </div>
                    <div className="text-center p-3 bg-white/10 rounded-xl">
                      <PhoneForwarded className="w-5 h-5 mx-auto mb-2" />
                      <div className="text-2xl font-bold">6</div>
                      <div className="text-xs text-white/60">Forwarded</div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Availability Mode */}
              <SettingsCard title="Availability Mode" icon={Clock}>
                <div className="space-y-3">
                  {[
                    { value: 'always' as const, label: 'AI Always On', desc: 'AI handles all calls, forwards emergencies' },
                    { value: 'scheduled' as const, label: 'Scheduled', desc: 'AI only during quiet hours' },
                    { value: 'manual' as const, label: 'Manual', desc: 'You control when AI takes over' },
                  ].map((mode) => (
                    <label
                      key={mode.value}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                        callSettings.availabilityMode === mode.value
                          ? 'bg-[#500000]/10 border-2 border-[#500000]'
                          : 'bg-[#F5F5F0] border-2 border-transparent hover:border-[#500000]/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="availabilityMode"
                        value={mode.value}
                        checked={callSettings.availabilityMode === mode.value}
                        onChange={() => {
                          setCallSettings(prev => ({ ...prev, availabilityMode: mode.value }));
                          setHasChanges(true);
                        }}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        callSettings.availabilityMode === mode.value ? 'border-[#500000] bg-[#500000]' : 'border-[#2D2D2D]/30'
                      }`}>
                        {callSettings.availabilityMode === mode.value && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[#2D2D2D]">{mode.label}</div>
                        <div className="text-sm text-[#2D2D2D]/60">{mode.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </SettingsCard>

              {/* Quiet Hours */}
              <SettingsCard title="Quiet Hours (Sleep Schedule)" icon={Moon}>
                <ToggleOption
                  enabled={callSettings.quietHoursEnabled}
                  onChange={(v) => {
                    setCallSettings(prev => ({ ...prev, quietHoursEnabled: v }));
                    setHasChanges(true);
                  }}
                  label="Enable Quiet Hours"
                  description="AI automatically handles calls during these hours"
                />
                {callSettings.quietHoursEnabled && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-sm text-[#2D2D2D]/60 block mb-1">Start Time</label>
                      <div className="flex items-center gap-2 p-3 bg-[#F5F5F0] rounded-xl">
                        <Moon className="w-4 h-4 text-[#500000]" />
                        <input
                          type="time"
                          value={callSettings.quietHoursStart}
                          onChange={(e) => {
                            setCallSettings(prev => ({ ...prev, quietHoursStart: e.target.value }));
                            setHasChanges(true);
                          }}
                          className="bg-transparent text-[#2D2D2D] font-medium"
                        />
                      </div>
                    </div>
                    <div className="text-[#2D2D2D]/30 mt-6">to</div>
                    <div className="flex-1">
                      <label className="text-sm text-[#2D2D2D]/60 block mb-1">End Time</label>
                      <div className="flex items-center gap-2 p-3 bg-[#F5F5F0] rounded-xl">
                        <Sun className="w-4 h-4 text-[#C4A777]" />
                        <input
                          type="time"
                          value={callSettings.quietHoursEnd}
                          onChange={(e) => {
                            setCallSettings(prev => ({ ...prev, quietHoursEnd: e.target.value }));
                            setHasChanges(true);
                          }}
                          className="bg-transparent text-[#2D2D2D] font-medium"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </SettingsCard>

              {/* Emergency Routing */}
              <SettingsCard title="Emergency Routing" icon={AlertTriangle}>
                <ToggleOption
                  enabled={callSettings.emergencyBypass}
                  onChange={(v) => {
                    setCallSettings(prev => ({ ...prev, emergencyBypass: v }));
                    setHasChanges(true);
                  }}
                  label="Emergency Call Bypass"
                  description="Always forward calls mentioning emergencies directly to you"
                />
                {callSettings.emergencyBypass && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                    <label className="text-sm text-[#2D2D2D]/60 block mb-2">Emergency Keywords</label>
                    <div className="flex flex-wrap gap-2">
                      {callSettings.emergencyKeywords.map((keyword, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm">
                          {keyword}
                          <button
                            onClick={() => {
                              setCallSettings(prev => ({
                                ...prev,
                                emergencyKeywords: prev.emergencyKeywords.filter((_, i) => i !== idx)
                              }));
                              setHasChanges(true);
                            }}
                            className="hover:text-red-900"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="Add keyword..."
                        className="px-3 py-1.5 bg-[#F5F5F0] rounded-full text-sm w-32"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            setCallSettings(prev => ({
                              ...prev,
                              emergencyKeywords: [...prev.emergencyKeywords, e.currentTarget.value]
                            }));
                            e.currentTarget.value = '';
                            setHasChanges(true);
                          }
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </SettingsCard>

              {/* AI Greeting */}
              <SettingsCard title="AI Greeting" icon={MessageSquare}>
                <div>
                  <label className="text-sm text-[#2D2D2D]/60 block mb-2">How the AI answers calls</label>
                  <textarea
                    value={callSettings.aiGreeting}
                    onChange={(e) => {
                      setCallSettings(prev => ({ ...prev, aiGreeting: e.target.value }));
                      setHasChanges(true);
                    }}
                    rows={3}
                    className="w-full p-4 bg-[#F5F5F0] rounded-xl text-[#2D2D2D] resize-none border-2 border-transparent focus:border-[#500000] focus:outline-none"
                  />
                </div>
              </SettingsCard>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* NOTIFICATIONS TAB */}
          {/* ============================================================== */}
          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <SettingsCard title="Notification Channels" icon={Bell}>
                <div className="space-y-4">
                  <ToggleOption
                    enabled={notifications.emailNotifications}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, emailNotifications: v }));
                      setHasChanges(true);
                    }}
                    label="Email Notifications"
                    description="Receive notifications via email"
                  />
                  <ToggleOption
                    enabled={notifications.pushNotifications}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, pushNotifications: v }));
                      setHasChanges(true);
                    }}
                    label="Push Notifications"
                    description="Browser and mobile push notifications"
                  />
                  <ToggleOption
                    enabled={notifications.smsNotifications}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, smsNotifications: v }));
                      setHasChanges(true);
                    }}
                    label="SMS Notifications"
                    description="Text message alerts for urgent items"
                  />
                </div>
              </SettingsCard>

              <SettingsCard title="Alert Types" icon={AlertCircle}>
                <div className="space-y-4">
                  <ToggleOption
                    enabled={notifications.bookingAlerts}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, bookingAlerts: v }));
                      setHasChanges(true);
                    }}
                    label="Booking Alerts"
                    description="New bookings, cancellations, and modifications"
                  />
                  <ToggleOption
                    enabled={notifications.messageAlerts}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, messageAlerts: v }));
                      setHasChanges(true);
                    }}
                    label="Message Alerts"
                    description="Guest messages and inquiries"
                  />
                  <ToggleOption
                    enabled={notifications.paymentAlerts}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, paymentAlerts: v }));
                      setHasChanges(true);
                    }}
                    label="Payment Alerts"
                    description="Payments received and failed transactions"
                  />
                  <ToggleOption
                    enabled={notifications.maintenanceAlerts}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, maintenanceAlerts: v }));
                      setHasChanges(true);
                    }}
                    label="Maintenance Alerts"
                    description="Cleaning schedules and maintenance issues"
                  />
                  <ToggleOption
                    enabled={notifications.reviewAlerts}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, reviewAlerts: v }));
                      setHasChanges(true);
                    }}
                    label="Review Alerts"
                    description="New guest reviews"
                  />
                </div>
              </SettingsCard>

              <SettingsCard title="Digest & Quiet Hours" icon={Clock}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Email Digest Frequency</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['realtime', 'hourly', 'daily', 'weekly'] as const).map((freq) => (
                        <button
                          key={freq}
                          onClick={() => {
                            setNotifications(prev => ({ ...prev, digestFrequency: freq }));
                            setHasChanges(true);
                          }}
                          className={`p-3 rounded-xl text-center transition-all capitalize ${
                            notifications.digestFrequency === freq
                              ? 'bg-[#500000] text-white'
                              : 'bg-[#F5F5F0] text-[#2D2D2D] hover:bg-[#500000]/10'
                          }`}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ToggleOption
                    enabled={notifications.quietHours}
                    onChange={(v) => {
                      setNotifications(prev => ({ ...prev, quietHours: v }));
                      setHasChanges(true);
                    }}
                    label="Notification Quiet Hours"
                    description="Mute non-urgent notifications during these hours"
                  />

                  {notifications.quietHours && (
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1">
                        <input
                          type="time"
                          value={notifications.quietStart}
                          onChange={(e) => {
                            setNotifications(prev => ({ ...prev, quietStart: e.target.value }));
                            setHasChanges(true);
                          }}
                          className="w-full p-3 bg-[#F5F5F0] rounded-xl"
                        />
                      </div>
                      <span className="text-[#2D2D2D]/40">to</span>
                      <div className="flex-1">
                        <input
                          type="time"
                          value={notifications.quietEnd}
                          onChange={(e) => {
                            setNotifications(prev => ({ ...prev, quietEnd: e.target.value }));
                            setHasChanges(true);
                          }}
                          className="w-full p-3 bg-[#F5F5F0] rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </SettingsCard>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* SECURITY TAB */}
          {/* ============================================================== */}
          {activeTab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <SettingsCard title="Password" icon={Lock}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#2D2D2D]">Password</p>
                    <p className="text-sm text-[#2D2D2D]/60">Last changed 30 days ago</p>
                  </div>
                  <button
                    onClick={() => setShowChangePassword(!showChangePassword)}
                    className="px-4 py-2 bg-[#F5F5F0] text-[#500000] font-medium rounded-xl hover:bg-[#500000]/10 transition-colors"
                  >
                    Change Password
                  </button>
                </div>

                {showChangePassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-[#2D2D2D]/10 space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Current Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-2 border-transparent focus:border-[#500000] focus:outline-none"
                      />
                    </div>
                    <button className="w-full py-3 bg-[#500000] text-white font-medium rounded-xl hover:bg-[#500000]/90 transition-colors">
                      Update Password
                    </button>
                  </motion.div>
                )}
              </SettingsCard>

              <SettingsCard title="Two-Factor Authentication" icon={ShieldCheck}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#2D2D2D]">Two-Factor Authentication</p>
                    <p className="text-sm text-[#2D2D2D]/60">
                      {twoFactorEnabled ? 'Enabled via authenticator app' : 'Add an extra layer of security'}
                    </p>
                  </div>
                  <button
                    onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                    className={`px-4 py-2 font-medium rounded-xl transition-colors ${
                      twoFactorEnabled
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-[#500000] text-white hover:bg-[#500000]/90'
                    }`}
                  >
                    {twoFactorEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>

                {twoFactorEnabled && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="text-emerald-700">Two-factor authentication is active</span>
                  </div>
                )}
              </SettingsCard>

              <SettingsCard title="Active Sessions" icon={Monitor}>
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onRevoke={() => handleRevokeSession(session.id)}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    setSessions(prev => prev.filter(s => s.isCurrent));
                    toast.success('All other sessions revoked');
                  }}
                  className="mt-4 w-full py-3 border-2 border-red-200 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors"
                >
                  Revoke All Other Sessions
                </button>
              </SettingsCard>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TEAM TAB */}
          {/* ============================================================== */}
          {activeTab === 'team' && (
            <motion.div
              key="team"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <SettingsCard
                title="Team Members"
                description={`${team.length} members`}
                icon={Users}
                action={
                  <button
                    onClick={() => setInviteModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#500000] text-white font-medium rounded-xl hover:bg-[#500000]/90 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite
                  </button>
                }
              >
                <div className="space-y-3">
                  {team.map((member) => (
                    <TeamMemberCard
                      key={member.id}
                      member={member}
                      onEdit={() => toast('Edit permissions modal coming soon')}
                      onRemove={() => handleRemoveTeamMember(member.id)}
                      onResend={() => toast.success(`Invite resent to ${member.email}`)}
                    />
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard title="Role Permissions" icon={Shield}>
                <div className="space-y-4">
                  {[
                    { role: 'Admin', desc: 'Full access except billing', perms: ['Properties', 'Guests', 'Cleaning', 'Messages', 'Settings'] },
                    { role: 'Manager', desc: 'Manage daily operations', perms: ['Properties', 'Guests', 'Cleaning'] },
                    { role: 'Cleaner', desc: 'View and update cleaning', perms: ['Cleaning'] },
                  ].map((r) => (
                    <div key={r.role} className="p-4 bg-[#F5F5F0] rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-[#2D2D2D]">{r.role}</h4>
                        <span className="text-sm text-[#2D2D2D]/60">{r.desc}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.perms.map((p) => (
                          <span key={p} className="px-2 py-1 bg-white text-[#2D2D2D]/70 text-xs rounded-lg">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsCard>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* BILLING TAB */}
          {/* ============================================================== */}
          {activeTab === 'billing' && (
            <motion.div
              key="billing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Current Plan */}
              <div className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-white/70 text-sm">Current Plan</p>
                    <h2 className="text-2xl font-['Playfair_Display'] font-bold">
                      {PLANS[billing.plan].name}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">${PLANS[billing.plan].price}</p>
                    <p className="text-white/70 text-sm">per month</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {PLANS[billing.plan].features.map((f) => (
                    <span key={f} className="px-3 py-1 bg-white/20 rounded-full text-sm">
                      {f}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/20">
                  <p className="text-white/70 text-sm">
                    Next billing: {formatDate(billing.nextBillingDate)}
                  </p>
                  <button className="px-4 py-2 bg-white text-[#500000] font-medium rounded-xl hover:bg-white/90 transition-colors">
                    Upgrade Plan
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <SettingsCard title="Payment Method" icon={CreditCard}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-10 bg-[#F5F5F0] rounded-lg flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-[#500000]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#2D2D2D]">
                        {billing.paymentMethod.brand} ending in {billing.paymentMethod.last4}
                      </p>
                      <p className="text-sm text-[#2D2D2D]/60">
                        Expires {billing.paymentMethod.expiry}
                      </p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-[#F5F5F0] text-[#500000] font-medium rounded-xl hover:bg-[#500000]/10 transition-colors">
                    Update
                  </button>
                </div>
              </SettingsCard>

              {/* Invoice History */}
              <SettingsCard title="Invoice History" icon={History}>
                <div className="space-y-2">
                  {billing.invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 bg-[#F5F5F0] rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                          <Download className="w-5 h-5 text-[#500000]" />
                        </div>
                        <div>
                          <p className="font-medium text-[#2D2D2D]">
                            {formatDate(invoice.date)}
                          </p>
                          <p className="text-sm text-[#2D2D2D]/60">
                            Invoice #{invoice.id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {invoice.status}
                        </span>
                        <span className="font-semibold text-[#2D2D2D]">${invoice.amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsCard>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* DATA TAB */}
          {/* ============================================================== */}
          {activeTab === 'data' && (
            <motion.div
              key="data"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <SettingsCard title="Export Data" icon={Download}>
                <p className="text-[#2D2D2D]/60 mb-4">
                  Download a copy of your data including properties, bookings, guests, and financial records.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { label: 'Properties', desc: '22 properties', icon: Building2 },
                    { label: 'Bookings', desc: '1,247 records', icon: Calendar },
                    { label: 'Financial', desc: 'All transactions', icon: CreditCard },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => toast.success(`Exporting ${item.label}...`)}
                      className="p-4 bg-[#F5F5F0] rounded-xl text-left hover:bg-[#500000]/10 transition-colors group"
                    >
                      <item.icon className="w-8 h-8 text-[#500000] mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-semibold text-[#2D2D2D]">{item.label}</h4>
                      <p className="text-sm text-[#2D2D2D]/60">{item.desc}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => toast.success('Preparing full export...')}
                  className="mt-4 w-full py-3 bg-[#500000] text-white font-medium rounded-xl hover:bg-[#500000]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export All Data
                </button>
              </SettingsCard>

              <SettingsCard title="Import Data" icon={Upload}>
                <p className="text-[#2D2D2D]/60 mb-4">
                  Import data from CSV files or other property management systems.
                </p>
                <div className="border-2 border-dashed border-[#2D2D2D]/20 rounded-xl p-8 text-center hover:border-[#500000] transition-colors cursor-pointer">
                  <Upload className="w-10 h-10 text-[#2D2D2D]/40 mx-auto mb-3" />
                  <p className="font-medium text-[#2D2D2D]">Drop files here or click to upload</p>
                  <p className="text-sm text-[#2D2D2D]/60 mt-1">CSV, JSON, or Excel files supported</p>
                </div>
              </SettingsCard>

              <SettingsCard title="Danger Zone" icon={AlertTriangle}>
                <div className="p-4 border-2 border-red-200 rounded-xl bg-red-50">
                  <h4 className="font-semibold text-red-700 mb-2">Delete Account</h4>
                  <p className="text-sm text-red-600 mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <button className="px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors">
                    Delete My Account
                  </button>
                </div>
              </SettingsCard>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <InviteTeamModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvite={handleInviteTeam}
      />

      <ConnectIntegrationModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        integration={selectedIntegration}
        onSubmit={handleIntegrationConnect}
      />

      {/* Keyboard Shortcuts Help */}
      <div className="fixed bottom-4 right-4 text-xs text-[#2D2D2D]/40">
        <kbd className="px-2 py-1 bg-white rounded shadow">Ctrl</kbd>+
        <kbd className="px-2 py-1 bg-white rounded shadow">S</kbd> to save
      </div>
    </div>
  );
}
