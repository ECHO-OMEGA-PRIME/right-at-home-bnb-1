"use client";

import { useState, useCallback } from "react";
import {
  Plug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Globe,
  CreditCard,
  MessageSquare,
  Home,
  Activity,
  DollarSign,
  Webhook,
  Settings,
  List,
  LayoutGrid,
  ExternalLink,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  ChevronRight,
  Search,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatMoneyCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return formatMoney(cents);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ChannelStatus = "connected" | "disconnected";

interface Integration {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: ChannelStatus;
  properties: number;
  bookings: number;
  revenueCents: number;
  features: string[];
  lastSync: string;
  webhookUrl: string;
  apiKeyMasked: string;
  syncSchedule: string;
  color: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  channel: string;
  event: string;
  status: "success" | "warning" | "error";
  message: string;
}

type TabKey = "overview" | "logs" | "settings";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const INTEGRATIONS: Integration[] = [
  {
    id: "vrbo",
    name: "VRBO / Expedia",
    icon: <Home className="w-6 h-6" />,
    status: "connected",
    properties: 22,
    bookings: 847,
    revenueCents: 128_000_00,
    features: ["iCal Sync", "Direct API", "Instant Book", "Reviews Sync"],
    lastSync: "2026-03-17T14:32:00Z",
    webhookUrl: "https://api.rightathome-bnb.com/webhooks/vrbo",
    apiKeyMasked: "vrbo_live_****************************7f3a",
    syncSchedule: "Every 15 minutes",
    color: "#0e47a1",
  },
  {
    id: "airbnb",
    name: "Airbnb",
    icon: <Home className="w-6 h-6" />,
    status: "connected",
    properties: 18,
    bookings: 623,
    revenueCents: 96_700_00,
    features: ["iCal Sync", "Messaging API", "Smart Pricing", "Co-Host Tools"],
    lastSync: "2026-03-17T14:28:00Z",
    webhookUrl: "https://api.rightathome-bnb.com/webhooks/airbnb",
    apiKeyMasked: "abnb_pk_****************************9d12",
    syncSchedule: "Every 15 minutes",
    color: "#ff5a5f",
  },
  {
    id: "booking",
    name: "Booking.com",
    icon: <Globe className="w-6 h-6" />,
    status: "disconnected",
    properties: 0,
    bookings: 0,
    revenueCents: 0,
    features: ["XML Feed", "OTA Sync", "Rate Plans", "Promotions"],
    lastSync: "",
    webhookUrl: "",
    apiKeyMasked: "",
    syncSchedule: "Not configured",
    color: "#003580",
  },
  {
    id: "google",
    name: "Google Rentals",
    icon: <Search className="w-6 h-6" />,
    status: "connected",
    properties: 22,
    bookings: 156,
    revenueCents: 0,
    features: ["Free Listings", "Hotel Ads", "Analytics", "Reviews"],
    lastSync: "2026-03-17T13:45:00Z",
    webhookUrl: "https://api.rightathome-bnb.com/webhooks/google",
    apiKeyMasked: "goog_api_****************************c4e1",
    syncSchedule: "Every 30 minutes",
    color: "#4285f4",
  },
  {
    id: "stripe",
    name: "Stripe Payments",
    icon: <CreditCard className="w-6 h-6" />,
    status: "connected",
    properties: 22,
    bookings: 1626,
    revenueCents: 248_000_00,
    features: ["Direct Charges", "Subscriptions", "Disputes", "Payouts"],
    lastSync: "2026-03-17T14:35:00Z",
    webhookUrl: "https://api.rightathome-bnb.com/webhooks/stripe",
    apiKeyMasked: "sk_live_****************************mN4x",
    syncSchedule: "Real-time (webhooks)",
    color: "#635bff",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    icon: <MessageSquare className="w-6 h-6" />,
    status: "connected",
    properties: 22,
    bookings: 0,
    revenueCents: 0,
    features: ["Guest Notifications", "Check-in Codes", "Two-Way Chat", "Auto-Replies"],
    lastSync: "2026-03-17T14:30:00Z",
    webhookUrl: "https://api.rightathome-bnb.com/webhooks/twilio",
    apiKeyMasked: "AC****************************d920",
    syncSchedule: "Real-time (webhooks)",
    color: "#f22f46",
  },
];

const ACTIVITY_LOGS: LogEntry[] = [
  {
    id: "1",
    timestamp: "2026-03-17T14:35:12Z",
    channel: "Stripe",
    event: "payment.succeeded",
    status: "success",
    message: "Payment of $487.00 received for booking #BK-4821",
  },
  {
    id: "2",
    timestamp: "2026-03-17T14:32:04Z",
    channel: "VRBO / Expedia",
    event: "reservation.created",
    status: "success",
    message:
      "New reservation synced: Guest Sarah M. \u2014 Mar 22-25, Pecan Grove Cabin",
  },
  {
    id: "3",
    timestamp: "2026-03-17T14:28:55Z",
    channel: "Airbnb",
    event: "calendar.sync",
    status: "success",
    message: "Calendar sync completed for 18 properties \u2014 0 conflicts",
  },
  {
    id: "4",
    timestamp: "2026-03-17T14:15:33Z",
    channel: "Twilio SMS",
    event: "message.sent",
    status: "success",
    message:
      "Check-in code sent to guest +1 (432) ***-**89 for Bluebonnet Suite",
  },
  {
    id: "5",
    timestamp: "2026-03-17T13:58:01Z",
    channel: "Google Rentals",
    event: "listing.update",
    status: "warning",
    message:
      "Photo validation warning: 2 images below recommended resolution (1024x768)",
  },
  {
    id: "6",
    timestamp: "2026-03-17T13:45:22Z",
    channel: "Google Rentals",
    event: "feed.sync",
    status: "success",
    message: "Property feed synced \u2014 22 listings active, 0 errors",
  },
  {
    id: "7",
    timestamp: "2026-03-17T13:30:10Z",
    channel: "VRBO / Expedia",
    event: "review.received",
    status: "success",
    message: "New 5-star review from Guest Tom R. for Longhorn Lodge",
  },
  {
    id: "8",
    timestamp: "2026-03-17T12:55:44Z",
    channel: "Stripe",
    event: "payout.completed",
    status: "success",
    message: "Payout of $12,340.00 deposited to ****4417",
  },
  {
    id: "9",
    timestamp: "2026-03-17T12:20:18Z",
    channel: "Airbnb",
    event: "reservation.modified",
    status: "warning",
    message:
      "Guest requested date change: BK-4799 moved from Mar 28-30 to Apr 2-4",
  },
  {
    id: "10",
    timestamp: "2026-03-17T11:45:02Z",
    channel: "Booking.com",
    event: "connection.failed",
    status: "error",
    message:
      "API connection failed \u2014 credentials not configured. Set up integration to enable sync.",
  },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: ChannelStatus }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      <XCircle className="w-3.5 h-3.5" />
      Disconnected
    </span>
  );
}

function LogStatusIcon({ status }: { status: LogEntry["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const connectedCount = INTEGRATIONS.filter(
    (i) => i.status === "connected",
  ).length;
  const totalBookings = INTEGRATIONS.reduce((sum, i) => sum + i.bookings, 0);
  const totalRevenueCents = INTEGRATIONS.reduce(
    (sum, i) => sum + i.revenueCents,
    0,
  );
  const webhooksActive = INTEGRATIONS.filter(
    (i) => i.webhookUrl.length > 0,
  ).length;

  const handleSync = useCallback((id: string) => {
    setSyncingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  }, []);

  const toggleKeyVisibility = useCallback((id: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      key: "overview",
      label: "Overview",
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      key: "logs",
      label: "Activity Logs",
      icon: <List className="w-4 h-4" />,
    },
    {
      key: "settings",
      label: "Settings",
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#500000] text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Plug className="w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight">
              Channel Integrations
            </h1>
          </div>
          <p className="text-white/70 text-sm ml-11">
            Manage OTA connections, payment processing, and communication
            channels
          </p>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Plug className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {connectedCount}
                  <span className="text-sm font-normal text-gray-400">
                    /{INTEGRATIONS.length}
                  </span>
                </p>
                <p className="text-xs text-gray-500">Connected</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {totalBookings.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Total Bookings</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatMoneyCompact(totalRevenueCents)}
                </p>
                <p className="text-xs text-gray-500">Channel Revenue</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {webhooksActive}
                </p>
                <p className="text-xs text-gray-500">Webhooks Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#500000] text-[#500000]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ---- Overview Tab ---- */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {INTEGRATIONS.map((integration) => {
              const isSyncing = syncingIds.has(integration.id);
              const isConnected = integration.status === "connected";

              return (
                <div
                  key={integration.id}
                  className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
                    isConnected
                      ? "border-gray-200"
                      : "border-dashed border-gray-300 opacity-75"
                  }`}
                >
                  {/* Card accent bar */}
                  <div
                    className="h-1"
                    style={{ backgroundColor: integration.color }}
                  />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: integration.color }}
                        >
                          {integration.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {integration.name}
                          </h3>
                          <StatusBadge status={integration.status} />
                        </div>
                      </div>
                      {isConnected && (
                        <button
                          onClick={() => handleSync(integration.id)}
                          disabled={isSyncing}
                          className="p-2 rounded-lg text-gray-400 hover:text-[#500000] hover:bg-[#500000]/5 transition-colors disabled:opacity-50"
                          title="Sync now"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
                          />
                        </button>
                      )}
                    </div>

                    {/* Stats grid */}
                    {isConnected ? (
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-gray-900">
                            {integration.properties}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                            Properties
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-gray-900">
                            {integration.bookings.toLocaleString()}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                            Bookings
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-gray-900">
                            {integration.revenueCents > 0
                              ? formatMoneyCompact(integration.revenueCents)
                              : "--"}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                            Revenue
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center">
                        <p className="text-sm text-gray-500 mb-3">
                          Not yet configured
                        </p>
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#500000] text-white text-sm font-medium rounded-lg hover:bg-[#400000] transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Connect Channel
                        </button>
                      </div>
                    )}

                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {integration.features.map((feat) => (
                        <span
                          key={feat}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px] font-medium"
                        >
                          {feat}
                        </span>
                      ))}
                    </div>

                    {/* Last sync */}
                    {isConnected && integration.lastSync && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-2 border-t border-gray-100">
                        <Clock className="w-3 h-3" />
                        Last synced {relativeTime(integration.lastSync)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---- Logs Tab ---- */}
        {activeTab === "logs" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
              <span className="text-xs text-gray-400">
                {ACTIVITY_LOGS.length} events
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-10">
                      Status
                    </th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ACTIVITY_LOGS.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <LogStatusIcon status={log.status} />
                      </td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {relativeTime(log.timestamp)}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {log.channel}
                      </td>
                      <td className="px-5 py-3">
                        <code className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          {log.event}
                        </code>
                      </td>
                      <td className="px-5 py-3 text-gray-600 max-w-md truncate">
                        {log.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---- Settings Tab ---- */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {INTEGRATIONS.filter((i) => i.status === "connected").map(
              (integration) => (
                <div
                  key={integration.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: integration.color }}
                    >
                      {integration.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900">
                      {integration.name}
                    </h3>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Webhook URL */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                        Webhook URL
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={integration.webhookUrl}
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono"
                        />
                        <button
                          className="px-3 py-2 text-xs font-medium text-[#500000] bg-[#500000]/5 rounded-lg hover:bg-[#500000]/10 transition-colors"
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              integration.webhookUrl,
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Sync Schedule */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                        Sync Schedule
                      </label>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">
                          {integration.syncSchedule}
                        </span>
                      </div>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                        API Key
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type={
                            revealedKeys.has(integration.id)
                              ? "text"
                              : "password"
                          }
                          readOnly
                          value={integration.apiKeyMasked}
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono"
                        />
                        <button
                          onClick={() => toggleKeyVisibility(integration.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title={
                            revealedKeys.has(integration.id)
                              ? "Hide key"
                              : "Reveal key"
                          }
                        >
                          {revealedKeys.has(integration.id) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
