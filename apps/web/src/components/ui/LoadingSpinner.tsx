'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-maroon-800/30 border-t-maroon-600',
          sizeClasses[size]
        )}
      />
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message = 'Loading...' }: LoadingPageProps) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center">
      <LoadingSpinner size="xl" />
      <p className="mt-4 text-white/60 text-lg">{message}</p>
    </div>
  );
}

interface LoadingCardProps {
  className?: string;
}

export function LoadingCard({ className }: LoadingCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-6 animate-pulse',
        className
      )}
    >
      <div className="aspect-[4/3] bg-white/5 rounded-lg mb-4" />
      <div className="h-5 bg-white/5 rounded w-3/4 mb-2" />
      <div className="h-4 bg-white/5 rounded w-1/2 mb-4" />
      <div className="flex gap-4">
        <div className="h-4 bg-white/5 rounded w-16" />
        <div className="h-4 bg-white/5 rounded w-16" />
        <div className="h-4 bg-white/5 rounded w-16" />
      </div>
    </div>
  );
}

export function LoadingTable() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 overflow-hidden animate-pulse">
      <div className="p-4 border-b border-white/10">
        <div className="h-6 bg-white/5 rounded w-48" />
      </div>
      <div className="divide-y divide-white/5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 bg-white/5 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/5 rounded w-1/3" />
              <div className="h-3 bg-white/5 rounded w-1/4" />
            </div>
            <div className="h-6 bg-white/5 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default LoadingSpinner;
