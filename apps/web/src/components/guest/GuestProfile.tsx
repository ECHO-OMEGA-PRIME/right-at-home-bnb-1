'use client';

import React from 'react';
import { cn, formatDate, formatCurrency, formatPhone, getInitials, parseJsonField } from '@/lib/utils';
import type { Guest, Booking } from '@/lib/types';
import {
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Star,
  Crown,
  Tag,
  MessageSquare,
  Clock,
  Home,
} from 'lucide-react';

interface GuestProfileProps {
  guest: Guest & { bookings?: Booking[] };
  className?: string;
  variant?: 'full' | 'compact' | 'card';
  showBookings?: boolean;
}

export function GuestProfile({
  guest,
  className,
  variant = 'full',
  showBookings = true,
}: GuestProfileProps) {
  const tags = parseJsonField<string[]>(guest.tags, []);
  const preferences = parseJsonField<Record<string, string>>(guest.preferences, {});

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'p-4 rounded-xl border border-white/10 bg-[#1a0a0a]/80 backdrop-blur-sm',
          'hover:border-maroon-800/30 transition-colors',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold',
              guest.isVip
                ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 text-yellow-400 ring-2 ring-yellow-500/30'
                : 'bg-maroon-800/30 text-maroon-400'
            )}
          >
            {getInitials(guest.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{guest.name}</h3>
              {guest.isVip && (
                <Crown className="h-4 w-4 text-yellow-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-white/50 truncate">{guest.email}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-white/60">
            <Home className="h-4 w-4" />
            <span>{guest.totalStays} stays</span>
          </div>
          <div className="flex items-center gap-1 text-white/60">
            <DollarSign className="h-4 w-4" />
            <span>{formatCurrency(guest.totalSpent)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center font-semibold',
            guest.isVip
              ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 text-yellow-400'
              : 'bg-maroon-800/30 text-maroon-400'
          )}
        >
          {getInitials(guest.name)}
        </div>
        <div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-white">{guest.name}</span>
            {guest.isVip && <Crown className="h-3.5 w-3.5 text-yellow-400" />}
          </div>
          <span className="text-sm text-white/50">{guest.totalStays} stays</span>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start gap-4 p-6 rounded-xl border border-white/10 bg-[#1a0a0a]/80">
        <div
          className={cn(
            'h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold',
            guest.isVip
              ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 text-yellow-400 ring-4 ring-yellow-500/20'
              : 'bg-maroon-800/30 text-maroon-400 ring-4 ring-maroon-800/20'
          )}
        >
          {getInitials(guest.name)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-display font-bold text-white">{guest.name}</h2>
            {guest.isVip && (
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-medium flex items-center gap-1">
                <Crown className="h-3 w-3" />
                {guest.vipTier || 'VIP'}
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-white/60">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${guest.email}`} className="hover:text-maroon-400 transition-colors">
                {guest.email}
              </a>
            </div>
            {guest.phone && (
              <div className="flex items-center gap-2 text-white/60">
                <Phone className="h-4 w-4" />
                <a href={`tel:${guest.phone}`} className="hover:text-maroon-400 transition-colors">
                  {formatPhone(guest.phone)}
                </a>
              </div>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Tag className="h-4 w-4 text-white/40" />
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-white/10 bg-[#1a0a0a]/80">
          <div className="flex items-center gap-2 text-white/40 text-sm mb-1">
            <Home className="h-4 w-4" />
            Total Stays
          </div>
          <div className="text-2xl font-bold text-white">{guest.totalStays}</div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#1a0a0a]/80">
          <div className="flex items-center gap-2 text-white/40 text-sm mb-1">
            <DollarSign className="h-4 w-4" />
            Total Spent
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(guest.totalSpent)}</div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#1a0a0a]/80">
          <div className="flex items-center gap-2 text-white/40 text-sm mb-1">
            <Star className="h-4 w-4" />
            Avg Rating
          </div>
          <div className="text-2xl font-bold text-white">
            {guest.avgRating ? guest.avgRating.toFixed(1) : 'N/A'}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#1a0a0a]/80">
          <div className="flex items-center gap-2 text-white/40 text-sm mb-1">
            <Clock className="h-4 w-4" />
            Member Since
          </div>
          <div className="text-lg font-bold text-white">{formatDate(guest.createdAt, 'MMM yyyy')}</div>
        </div>
      </div>

      {/* Notes */}
      {guest.notes && (
        <div className="p-4 rounded-xl border border-white/10 bg-[#1a0a0a]/80">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
            <MessageSquare className="h-4 w-4" />
            Notes
          </div>
          <p className="text-white/80 whitespace-pre-wrap">{guest.notes}</p>
        </div>
      )}

      {/* Important Dates */}
      {(guest.birthday || guest.anniversary) && (
        <div className="p-4 rounded-xl border border-white/10 bg-[#1a0a0a]/80">
          <h3 className="text-white/60 text-sm mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Important Dates
          </h3>
          <div className="flex gap-4">
            {guest.birthday && (
              <div>
                <div className="text-xs text-white/40">Birthday</div>
                <div className="text-white">{formatDate(guest.birthday, 'MMMM d')}</div>
              </div>
            )}
            {guest.anniversary && (
              <div>
                <div className="text-xs text-white/40">Anniversary</div>
                <div className="text-white">{formatDate(guest.anniversary, 'MMMM d')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Bookings */}
      {showBookings && guest.bookings && guest.bookings.length > 0 && (
        <div className="p-4 rounded-xl border border-white/10 bg-[#1a0a0a]/80">
          <h3 className="text-white/60 text-sm mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Recent Stays
          </h3>
          <div className="space-y-3">
            {guest.bookings.slice(0, 5).map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div>
                  <div className="text-white">{booking.property?.name || 'Unknown Property'}</div>
                  <div className="text-sm text-white/50">
                    {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-medium">{formatCurrency(booking.totalPrice)}</div>
                  <div className="text-xs text-white/40">{booking.platform}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GuestProfile;
