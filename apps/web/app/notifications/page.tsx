'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Bell, AlertTriangle, Wrench, Leaf, Phone, MessageSquare,
  CheckCircle, X, ChevronRight, Clock, MapPin, Camera,
  Zap, Droplets, Wind, Package, ExternalLink, Home
} from 'lucide-react';
import {
  OwnerNotification,
  ServiceRequest,
  serviceProviders,
  getServiceProvider
} from '@/lib/cleaning-system';
import DashboardShell from '@/components/layout/DashboardShell';

// Mock notifications - empty for production
const mockNotifications: OwnerNotification[] = [];

const urgencyColors = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700 animate-pulse'
};

const serviceIcons: Record<ServiceRequest['type'], any> = {
  yard: Leaf,
  handyman: Wrench,
  plumber: Droplets,
  electrician: Zap,
  hvac: Wind,
  appliance: Package
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<OwnerNotification[]>(mockNotifications);
  const [selectedNotification, setSelectedNotification] = useState<OwnerNotification | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

  const unreadCount = notifications.filter(n => !n.readAt).length;
  const urgentCount = notifications.filter(n => n.urgency === 'urgent' && !n.actionTaken).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.readAt;
    if (filter === 'urgent') return n.urgency === 'urgent' || n.urgency === 'high';
    return true;
  });

  const handleNotificationClick = (notification: OwnerNotification) => {
    setSelectedNotification(notification);
    // Mark as read
    setNotifications(prev =>
      prev.map(n =>
        n.id === notification.id ? { ...n, readAt: new Date() } : n
      )
    );
  };

  const handleDispatch = (action: OwnerNotification['actionTaken']) => {
    if (!selectedNotification) return;

    setNotifications(prev =>
      prev.map(n =>
        n.id === selectedNotification.id
          ? { ...n, actionTaken: action, actionTakenAt: new Date() }
          : n
      )
    );
    setShowActionModal(false);
    setSelectedNotification(null);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <DashboardShell>
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <div className="bg-[#500000] text-white px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-7 h-7 text-[#C4A777]" />
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-white/70 text-sm">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          {urgentCount > 0 && (
            <div className="flex items-center gap-2 bg-red-500 px-3 py-1.5 rounded-full animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{urgentCount} urgent</span>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'unread', 'urgent'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-white text-[#500000]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-[#500000] text-white rounded-full text-xs">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="p-4 space-y-3">
        <AnimatePresence>
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">All Clear!</h3>
              <p className="text-gray-500">No notifications match this filter.</p>
            </motion.div>
          ) : (
            filteredNotifications.map((notification, index) => {
              const ServiceIcon = notification.serviceType
                ? serviceIcons[notification.serviceType]
                : Bell;

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleNotificationClick(notification)}
                  className={`bg-white rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                    !notification.readAt ? 'border-l-4 border-[#500000]' : ''
                  } ${notification.actionTaken ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-3 rounded-xl ${
                      notification.urgency === 'urgent'
                        ? 'bg-red-100 text-red-600'
                        : notification.urgency === 'high'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-[#500000]/10 text-[#500000]'
                    }`}>
                      <ServiceIcon className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`font-semibold ${!notification.readAt ? 'text-gray-900' : 'text-gray-600'}`}>
                          {notification.title}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${urgencyColors[notification.urgency]}`}>
                          {notification.urgency}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{notification.propertyAddress}</span>
                      </div>

                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {notification.message.split('\n')[0]}
                      </p>

                      {notification.photoUrls.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-[#500000]">
                          <Camera className="w-4 h-4" />
                          <span>{notification.photoUrls.length} photo{notification.photoUrls.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-400">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatTime(notification.createdAt)}
                        </span>
                        {notification.actionTaken ? (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Dispatched
                          </span>
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedNotification && !showActionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center"
            onClick={() => setSelectedNotification(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                <h2 className="font-bold text-lg">{selectedNotification.title}</h2>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Urgency Badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${urgencyColors[selectedNotification.urgency]}`}>
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium capitalize">{selectedNotification.urgency} Priority</span>
                </div>

                {/* Property */}
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-5 h-5" />
                  <span className="font-medium">{selectedNotification.propertyAddress}</span>
                </div>

                {/* Message */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-700 whitespace-pre-line">{selectedNotification.message}</p>
                </div>

                {/* Photos */}
                {selectedNotification.photoUrls.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Photos from Cleaning Crew
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedNotification.photoUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-40 object-cover rounded-xl"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Service Provider Info */}
                {selectedNotification.serviceType && (
                  <div className="bg-[#500000]/5 rounded-xl p-4">
                    <h3 className="font-semibold mb-2">Recommended Service Provider</h3>
                    {(() => {
                      const provider = getServiceProvider(selectedNotification.serviceType!);
                      if (!provider) return null;
                      return (
                        <div className="space-y-2">
                          <div className="font-medium text-[#500000]">{provider.name}</div>
                          <div className="text-sm text-gray-600">{provider.company}</div>
                          <div className="text-sm text-gray-500">{provider.notes}</div>
                          <a
                            href={`tel:${provider.phone}`}
                            className="inline-flex items-center gap-2 text-[#500000] font-medium mt-2"
                          >
                            <Phone className="w-4 h-4" />
                            {provider.phone}
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Action Buttons */}
                {!selectedNotification.actionTaken && (
                  <div className="space-y-3 pt-4">
                    <button
                      onClick={() => setShowActionModal(true)}
                      className="w-full bg-[#500000] text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
                    >
                      <Phone className="w-5 h-5" />
                      Dispatch Service Provider
                    </button>
                    <button
                      onClick={() => handleDispatch('dismissed')}
                      className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-medium"
                    >
                      Dismiss (I'll Handle It)
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispatch Action Modal */}
      <AnimatePresence>
        {showActionModal && selectedNotification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center"
            onClick={() => setShowActionModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-3xl"
            >
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-lg">Choose Service Provider</h2>
                <p className="text-sm text-gray-500">Select who to dispatch for this request</p>
              </div>

              <div className="p-4 space-y-3">
                {/* Yard Service */}
                {(selectedNotification.serviceType === 'yard' || !selectedNotification.serviceType) && (
                  <button
                    onClick={() => handleDispatch('dispatched_yard')}
                    className="w-full flex items-center gap-4 p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                  >
                    <div className="p-3 bg-green-500 rounded-xl text-white">
                      <Leaf className="w-6 h-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold">Midland Lawn Care</div>
                      <div className="text-sm text-gray-600">(432) 555-LAWN</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-green-600" />
                      <MessageSquare className="w-5 h-5 text-green-600" />
                    </div>
                  </button>
                )}

                {/* Handyman */}
                {(selectedNotification.serviceType === 'handyman' || !selectedNotification.serviceType) && (
                  <button
                    onClick={() => handleDispatch('dispatched_handyman')}
                    className="w-full flex items-center gap-4 p-4 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
                  >
                    <div className="p-3 bg-orange-500 rounded-xl text-white">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold">Miguel Rodriguez</div>
                      <div className="text-sm text-gray-600">(432) 555-0147</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-orange-600" />
                      <MessageSquare className="w-5 h-5 text-orange-600" />
                    </div>
                  </button>
                )}

                {/* HVAC */}
                {selectedNotification.serviceType === 'hvac' && (
                  <button
                    onClick={() => handleDispatch('dispatched_other')}
                    className="w-full flex items-center gap-4 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    <div className="p-3 bg-blue-500 rounded-xl text-white">
                      <Wind className="w-6 h-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold">Basin Air & Heat</div>
                      <div className="text-sm text-gray-600">(432) 555-COOL</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-blue-600" />
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                  </button>
                )}

                {/* Other Option */}
                <button
                  onClick={() => handleDispatch('dispatched_other')}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="p-3 bg-gray-500 rounded-xl text-white">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Call Another Provider</div>
                    <div className="text-sm text-gray-600">I'll handle this myself</div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="w-full py-3 text-gray-600 font-medium"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/" className="flex flex-col items-center text-gray-400 hover:text-[#500000]">
            <Home className="w-6 h-6" />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link href="/notifications" className="flex flex-col items-center text-[#500000]">
            <div className="relative">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className="text-xs mt-1 font-medium">Alerts</span>
          </Link>
          <Link href="/cleaning" className="flex flex-col items-center text-gray-400 hover:text-[#500000]">
            <Wrench className="w-6 h-6" />
            <span className="text-xs mt-1">Service</span>
          </Link>
        </div>
      </div>
    </div>
    </DashboardShell>
  );
}
