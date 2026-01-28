'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  variant = 'default',
}: StatsCardProps) {
  const variantStyles = {
    default: 'border-white/10',
    primary: 'border-maroon-800/50 bg-maroon-800/10',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    danger: 'border-red-500/30 bg-red-500/5',
  };

  const iconVariantStyles = {
    default: 'bg-white/5 text-white/60',
    primary: 'bg-maroon-800/20 text-maroon-400',
    success: 'bg-emerald-500/20 text-emerald-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    danger: 'bg-red-500/20 text-red-400',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-[#1a0a0a]/80 p-6',
        'backdrop-blur-sm transition-all duration-300',
        'hover:border-maroon-800/30 hover:shadow-lg hover:shadow-maroon-800/10',
        variantStyles[variant],
        className
      )}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-white/60 uppercase tracking-wider">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-white tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-white/40">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-white/40">vs last month</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg',
              iconVariantStyles[variant]
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
