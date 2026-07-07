'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock,
  ExternalLink, Loader2,
} from 'lucide-react';

interface SyncProperty {
  propertyId: string;
  propertyName: string;
  vrboId: string;
  vrboUrl: string;
  icalUrl: string | null;
  lastIcalSync: string | null;
  lastScrapeSync: string | null;
  syncEnabled: boolean;
  bookingCount: number;
  status: string;
}

interface SyncStats {
  totalProperties: number;
  enabledProperties: number;
  totalVrboBookings: number;
  last24h: {
    syncs: number;
    successes: number;
    failures: number;
    imported: number;
  };
}

interface SyncLog {
  syncType: string;
  status: string;
  itemsCreated: number;
  itemsUpdated: number;
  error: string | null;
  durationMs: number | null;
  at: string;
}

interface SyncStatusData {
  properties: SyncProperty[];
  stats: SyncStats;
  recentLogs: SyncLog[];
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SyncStatusPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<SyncStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/admin/vrbo-status');
      if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleSyncAll() {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/vrbo-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_all' }),
      });
      if (!res.ok) throw new Error('Sync failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading VRBO sync status...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        <XCircle className="w-4 h-4 inline mr-1" /> {error}
      </div>
    );
  }

  if (!data) return null;

  const { stats, properties, recentLogs } = data;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">VRBO Sync Status</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.enabledProperties}/{stats.totalProperties} properties enabled ·{' '}
            {stats.totalVrboBookings} VRBO bookings
          </p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-1.5 text-sm bg-maroon-800 text-white px-3 py-1.5 rounded-lg hover:bg-maroon-900 disabled:opacity-60"
        >
          {syncing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Sync Now
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: '24h Syncs', value: stats.last24h.syncs, icon: RefreshCw },
          { label: 'Imported', value: stats.last24h.imported, icon: CheckCircle },
          { label: 'Failures', value: stats.last24h.failures, icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
            <Icon className="w-4 h-4 mx-auto text-maroon-700 mb-1" />
            <div className="text-lg font-semibold">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {!compact && properties.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-3">Property</th>
                <th className="pb-2 pr-3">iCal</th>
                <th className="pb-2 pr-3">Scrape</th>
                <th className="pb-2">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {properties.slice(0, 8).map((p) => (
                <tr key={p.propertyId} className="border-b border-gray-50">
                  <td className="py-2 pr-3">
                    <a
                      href={p.vrboUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-maroon-800 hover:underline flex items-center gap-1"
                    >
                      {p.propertyName}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="py-2 pr-3 text-gray-600">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatRelativeTime(p.lastIcalSync)}
                    {!p.icalUrl && (
                      <span className="text-amber-600 text-xs ml-1">(no URL)</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">
                    {formatRelativeTime(p.lastScrapeSync)}
                  </td>
                  <td className="py-2">{p.bookingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recentLogs.length > 0 && (
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-700">Recent activity</p>
          {recentLogs.slice(0, 3).map((log, i) => (
            <div key={i} className="flex items-center gap-2">
              {log.status === 'success' ? (
                <CheckCircle className="w-3 h-3 text-green-600" />
              ) : (
                <XCircle className="w-3 h-3 text-red-500" />
              )}
              <span>
                {log.syncType}: +{log.itemsCreated} / ~{log.itemsUpdated} updated
                {' '}({formatRelativeTime(log.at)})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}