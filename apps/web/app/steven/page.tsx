'use client';

/**
 * Steven AI - Full Page Dashboard
 * Voice-enabled AI concierge with full operations context
 * @author ECHO OMEGA PRIME
 */

import StevenAI from '@/components/StevenAI';
import DashboardShell from '@/components/layout/DashboardShell';

export default function StevenAIPage() {
  return (
    <DashboardShell>
      <div className="p-6 h-[calc(100vh-2rem)]">
        <StevenAI mode="fullscreen" />
      </div>
    </DashboardShell>
  );
}
