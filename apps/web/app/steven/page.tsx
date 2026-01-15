'use client';

/**
 * Steven AI - Full Page Dashboard
 * Voice-enabled AI concierge with full operations context
 * @author ECHO OMEGA PRIME
 */

import StevenAI from '@/components/StevenAI';

export default function StevenAIPage() {
  return (
    <div className="p-6 h-[calc(100vh-2rem)]">
      <StevenAI mode="fullscreen" />
    </div>
  );
}
