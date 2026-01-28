'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneCall, PhoneOff, AlertTriangle, Check, User,
  Home, Clock, MessageSquare, Loader2, X, ChevronDown
} from 'lucide-react';

interface CallType {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  urgency: 'low' | 'normal' | 'high' | 'critical';
}

const CALL_TYPES: CallType[] = [
  {
    id: 'status_update',
    label: 'Status Update',
    description: 'General property status update',
    icon: <MessageSquare className="w-4 h-4" />,
    urgency: 'normal',
  },
  {
    id: 'cleaning_reminder',
    label: 'Cleaning Reminder',
    description: 'Remind cleaner of upcoming job',
    icon: <Clock className="w-4 h-4" />,
    urgency: 'normal',
  },
  {
    id: 'cleaning_complete',
    label: 'Cleaning Complete',
    description: 'Notify that cleaning is done',
    icon: <Check className="w-4 h-4" />,
    urgency: 'low',
  },
  {
    id: 'emergency',
    label: 'Emergency',
    description: 'Urgent - requires immediate attention',
    icon: <AlertTriangle className="w-4 h-4" />,
    urgency: 'critical',
  },
  {
    id: 'guest_checkin',
    label: 'Guest Check-In',
    description: 'Notify of guest arrival',
    icon: <User className="w-4 h-4" />,
    urgency: 'normal',
  },
  {
    id: 'guest_checkout',
    label: 'Guest Check-Out',
    description: 'Notify of guest departure',
    icon: <User className="w-4 h-4" />,
    urgency: 'normal',
  },
  {
    id: 'maintenance',
    label: 'Maintenance Alert',
    description: 'Property maintenance issue',
    icon: <Home className="w-4 h-4" />,
    urgency: 'high',
  },
  {
    id: 'custom',
    label: 'Custom Message',
    description: 'Send a custom voice message',
    icon: <Phone className="w-4 h-4" />,
    urgency: 'normal',
  },
];

interface QuickContact {
  name: string;
  phone: string;
  role: string;
}

const QUICK_CONTACTS: QuickContact[] = [
  { name: 'Steven Palma', phone: '+14325591904', role: 'Owner' },
];

interface PhoneCallPanelProps {
  propertyName?: string;
  propertyId?: string;
  cleanerName?: string;
  cleanerPhone?: string;
  guestName?: string;
  guestPhone?: string;
  onCallComplete?: (result: { success: boolean; callSid?: string }) => void;
}

export default function PhoneCallPanel({
  propertyName,
  propertyId,
  cleanerName,
  cleanerPhone,
  guestName,
  guestPhone,
  onCallComplete,
}: PhoneCallPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<CallType | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [callResult, setCallResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smsOnly, setSmsOnly] = useState(false);

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const handleSelectContact = (phone: string) => {
    setPhoneNumber(phone);
  };

  const handleCall = useCallback(async () => {
    if (!selectedType || !phoneNumber) return;

    setIsCalling(true);
    setCallResult(null);

    try {
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber,
          type: selectedType.id,
          propertyName,
          propertyId,
          cleanerName,
          guestName,
          message: message || undefined,
          scheduledTime: scheduledTime || undefined,
          urgency: selectedType.urgency,
          smsOnly,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCallResult({
          success: true,
          message: smsOnly
            ? `SMS sent successfully!`
            : `Call initiated! Call ID: ${data.callSid}`,
        });
        onCallComplete?.({ success: true, callSid: data.callSid });
      } else {
        setCallResult({
          success: false,
          message: data.error || 'Failed to make call',
        });
        onCallComplete?.({ success: false });
      }
    } catch (error) {
      setCallResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection error',
      });
      onCallComplete?.({ success: false });
    } finally {
      setIsCalling(false);
    }
  }, [
    selectedType,
    phoneNumber,
    propertyName,
    propertyId,
    cleanerName,
    guestName,
    message,
    scheduledTime,
    smsOnly,
    onCallComplete,
  ]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'normal':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'low':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#d4a574]/20 rounded-lg">
            <PhoneCall className="w-5 h-5 text-[#d4a574]" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white">AI Steven - Phone Calls</h3>
            <p className="text-sm text-white/60">Call cleaners, owner, or guests</p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-white/60 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10"
          >
            <div className="p-4 space-y-4">
              {/* Quick Contacts */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Quick Contacts</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_CONTACTS.map((contact) => (
                    <button
                      key={contact.phone}
                      onClick={() => handleSelectContact(contact.phone)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        phoneNumber === contact.phone
                          ? 'bg-[#d4a574] text-black'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {contact.name} ({contact.role})
                    </button>
                  ))}
                  {cleanerPhone && (
                    <button
                      onClick={() => handleSelectContact(cleanerPhone)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        phoneNumber === cleanerPhone
                          ? 'bg-[#d4a574] text-black'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {cleanerName || 'Cleaner'} (Cleaner)
                    </button>
                  )}
                  {guestPhone && (
                    <button
                      onClick={() => handleSelectContact(guestPhone)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        phoneNumber === guestPhone
                          ? 'bg-[#d4a574] text-black'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {guestName || 'Guest'} (Guest)
                    </button>
                  )}
                </div>
              </div>

              {/* Phone Number Input */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(432) 555-1234"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-[#d4a574] focus:outline-none"
                />
                {phoneNumber && (
                  <p className="text-xs text-white/40 mt-1">
                    Will call: {formatPhoneDisplay(phoneNumber)}
                  </p>
                )}
              </div>

              {/* Call Type Selection */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Call Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {CALL_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedType?.id === type.id
                          ? `${getUrgencyColor(type.urgency)} border-2`
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {type.icon}
                        <span className="text-sm font-medium text-white">{type.label}</span>
                      </div>
                      <p className="text-xs text-white/50 mt-1">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Message (for certain types) */}
              {selectedType && ['custom', 'emergency', 'maintenance', 'status_update'].includes(selectedType.id) && (
                <div>
                  <label className="block text-sm text-white/60 mb-2">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message..."
                    rows={3}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-[#d4a574] focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Scheduled Time (for cleaning reminder) */}
              {selectedType?.id === 'cleaning_reminder' && (
                <div>
                  <label className="block text-sm text-white/60 mb-2">Scheduled Time</label>
                  <input
                    type="text"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    placeholder="e.g., Today at 2 PM"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-[#d4a574] focus:outline-none"
                  />
                </div>
              )}

              {/* SMS Only Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSmsOnly(!smsOnly)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    smsOnly ? 'bg-[#d4a574]' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      smsOnly ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-white/80">
                  {smsOnly ? 'SMS Only' : 'Voice Call'}
                </span>
              </div>

              {/* Property Info (if available) */}
              {propertyName && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-sm text-white/60">Property</p>
                  <p className="text-white font-medium">{propertyName}</p>
                </div>
              )}

              {/* Call Result */}
              <AnimatePresence>
                {callResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-3 rounded-lg flex items-center gap-2 ${
                      callResult.success
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {callResult.success ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    <span className="text-sm">{callResult.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Call Button */}
              <button
                onClick={handleCall}
                disabled={!selectedType || !phoneNumber || isCalling}
                className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  !selectedType || !phoneNumber || isCalling
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : selectedType.urgency === 'critical'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-[#d4a574] text-black hover:bg-[#c49664]'
                }`}
              >
                {isCalling ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {smsOnly ? 'Sending SMS...' : 'Calling...'}
                  </>
                ) : (
                  <>
                    {smsOnly ? (
                      <MessageSquare className="w-5 h-5" />
                    ) : (
                      <Phone className="w-5 h-5" />
                    )}
                    {smsOnly ? 'Send SMS' : 'Make Call'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
