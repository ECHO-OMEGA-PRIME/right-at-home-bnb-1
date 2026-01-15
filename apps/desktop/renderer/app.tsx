/**
 * Right at Home BnB - Desktop App
 * Electron renderer with React
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

// TypeScript types for Electron API
declare global {
  interface Window {
    electronAPI: {
      getStore: (key: string) => Promise<any>;
      setStore: (key: string, value: any) => Promise<boolean>;
      showNotification: (title: string, body: string, options?: any) => Promise<boolean>;
      updateTrayStats: (stats: any) => Promise<boolean>;
      onNavigate: (callback: (route: string) => void) => void;
      onDeepLink: (callback: (url: string) => void) => void;
      openExternal: (url: string) => Promise<boolean>;
      getAppInfo: () => Promise<{ version: string; name: string; platform: string }>;
      platform: string;
    };
  }
}

// TEXAS A&M AGGIES COLORS - Maroon + White
const COLORS = {
  maroon: '#500000',        // Official Aggie Maroon
  maroonDark: '#3D0000',    // Darker shade
  maroonLight: '#722F37',   // Lighter shade
  white: '#FFFFFF',         // Pure white
  charcoal: '#2D2D2D',      // Text color
  green: '#4CAF50',
  red: '#EF4444',
};

// Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: true,
    },
  },
});

// Sidebar Navigation Item
const NavItem = ({ icon, label, active, onClick, badge }: any) => (
  <motion.button
    whileHover={{ x: 4 }}
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 12,
      border: 'none',
      cursor: 'pointer',
      width: '100%',
      background: active ? COLORS.maroon : 'transparent',
      color: active ? COLORS.white : COLORS.charcoal + 'B0',
      fontSize: 14,
      fontWeight: 500,
      position: 'relative',
      transition: 'background 0.2s, color 0.2s',
    }}
  >
    <span style={{ fontSize: 20 }}>{icon}</span>
    <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
    {badge > 0 && (
      <span style={{
        background: active ? COLORS.white : COLORS.maroon,
        color: active ? COLORS.maroon : COLORS.white,
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 10,
      }}>
        {badge}
      </span>
    )}
  </motion.button>
);

// Stat Card Component
const StatCard = ({ icon, label, value, trend, trendUp }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      background: COLORS.white,
      borderRadius: 16,
      padding: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.maroon }}>{value}</div>
        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{label}</div>
      </div>
      <div style={{ fontSize: 32 }}>{icon}</div>
    </div>
    {trend && (
      <div style={{
        marginTop: 12,
        fontSize: 12,
        color: trendUp ? COLORS.green : COLORS.red,
        fontWeight: 500,
      }}>
        {trendUp ? '↑' : '↓'} {trend}
      </div>
    )}
  </motion.div>
);

// Today's Schedule Item
const ScheduleItem = ({ property, time, status, cleaner }: any) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #EEE',
    gap: 12,
  }}>
    <div style={{
      width: 10,
      height: 10,
      borderRadius: 5,
      background: status === 'completed' ? COLORS.green
        : status === 'in_progress' ? '#FFA500'
        : status === 'urgent' ? COLORS.red
        : '#DDD',
    }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, color: COLORS.charcoal }}>{property}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{cleaner}</div>
    </div>
    <div style={{ fontSize: 13, color: '#666' }}>{time}</div>
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      padding: '4px 10px',
      borderRadius: 20,
      background: status === 'completed' ? '#E8F5E9'
        : status === 'in_progress' ? '#FFF8E1'
        : status === 'urgent' ? '#FEE2E2'
        : '#F0F0F0',
      color: status === 'completed' ? '#2E7D32'
        : status === 'in_progress' ? '#F57C00'
        : status === 'urgent' ? '#C62828'
        : '#666',
      textTransform: 'uppercase',
    }}>
      {status.replace('_', ' ')}
    </div>
  </div>
);

// Main App Component
function App() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appInfo, setAppInfo] = useState<any>(null);

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => ({
      todayJobs: 8,
      checkInsToday: 5,
      pendingCleanings: 3,
      occupancy: 86,
      revenue: 12450,
      revenueChange: '+12.5%',
      messagesUnread: 4,
      locksOnline: 22,
    }),
    refetchInterval: 60000, // Refresh every minute
  });

  // Update tray stats when data changes
  useEffect(() => {
    if (stats && window.electronAPI) {
      window.electronAPI.updateTrayStats({
        todayJobs: stats.todayJobs,
        checkInsToday: stats.checkInsToday,
        pendingCleanings: stats.pendingCleanings,
      });
    }
  }, [stats]);

  // Get app info on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppInfo().then(setAppInfo);
    }
  }, []);

  // Listen for navigation from tray menu
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onNavigate((route) => {
        setCurrentRoute(route.replace('/', '') || 'dashboard');
      });
    }
  }, []);

  const navigation = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'properties', icon: '🏢', label: 'Properties' },
    { id: 'schedule', icon: '📅', label: 'Schedule' },
    { id: 'cleaners', icon: '✨', label: 'Cleaners' },
    { id: 'guests', icon: '👥', label: 'Guests' },
    { id: 'messages', icon: '💬', label: 'Messages', badge: stats?.messagesUnread },
    { id: 'locks', icon: '🔐', label: 'Smart Locks' },
    { id: 'finance', icon: '💰', label: 'Finance' },
  ];

  const todaySchedule = [
    { property: 'Castleford Estate', time: '9:00 AM', status: 'completed', cleaner: 'Maria S.' },
    { property: 'Basin View Cottage', time: '11:30 AM', status: 'completed', cleaner: 'Roberto L.' },
    { property: 'Permian Palace', time: '2:00 PM', status: 'in_progress', cleaner: 'Maria S.' },
    { property: 'Desert Rose Villa', time: '3:30 PM', status: 'urgent', cleaner: 'Unassigned' },
    { property: 'Sunset Retreat', time: '5:00 PM', status: 'scheduled', cleaner: 'Jennifer K.' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5' }}>
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 72 : 260 }}
        style={{
          background: COLORS.white,
          borderRight: `1px solid ${COLORS.charcoal}15`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* RAH Logo - Baseball Style */}
        <div style={{
          padding: sidebarCollapsed ? '20px 16px' : '20px 24px',
          borderBottom: `1px solid ${COLORS.charcoal}10`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: COLORS.maroon,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              color: COLORS.white,
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontStyle: 'italic',
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 1,
            }}>
              RAH
            </span>
          </div>
          {!sidebarCollapsed && (
            <div>
              <div style={{
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                fontStyle: 'italic',
                fontWeight: 900,
                color: COLORS.maroon,
                fontSize: 22,
                letterSpacing: 2,
                textShadow: '1px 1px 0 #fff',
              }}>
                RAH
              </div>
              <div style={{ fontSize: 10, color: '#666', letterSpacing: 2, textTransform: 'uppercase' }}>Right at Home</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
          {navigation.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={!sidebarCollapsed ? item.label : ''}
              badge={!sidebarCollapsed ? item.badge : null}
              active={currentRoute === item.id}
              onClick={() => setCurrentRoute(item.id)}
            />
          ))}
        </nav>

        {/* User */}
        <div style={{
          padding: sidebarCollapsed ? '16px' : '16px 20px',
          borderTop: `1px solid ${COLORS.charcoal}10`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${COLORS.maroon}, #722F37)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.white,
            fontWeight: 600,
            fontSize: 13,
            flexShrink: 0,
          }}>
            SP
          </div>
          {!sidebarCollapsed && (
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Steven Palma</div>
              <div style={{ fontSize: 11, color: '#666' }}>Owner</div>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            position: 'absolute',
            top: 24,
            left: sidebarCollapsed ? 56 : 244,
            width: 24,
            height: 24,
            borderRadius: 12,
            border: `1px solid ${COLORS.charcoal}15`,
            background: COLORS.white,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 10,
          }}
        >
          <span style={{
            fontSize: 12,
            transform: sidebarCollapsed ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}>
            ◀
          </span>
        </button>
      </motion.aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        <AnimatePresence mode="wait">
          {currentRoute === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Header */}
              <div style={{ marginBottom: 32 }}>
                <h1 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 28,
                  fontWeight: 600,
                  color: COLORS.maroon,
                  marginBottom: 4,
                }}>
                  Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, Steven
                </h1>
                <p style={{ color: '#666', fontSize: 14 }}>
                  Here's what's happening with your properties today
                </p>
              </div>

              {/* Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 20,
                marginBottom: 32,
              }}>
                <StatCard
                  icon="📅"
                  label="Today's Jobs"
                  value={stats?.todayJobs || 0}
                />
                <StatCard
                  icon="🏠"
                  label="Occupancy"
                  value={`${stats?.occupancy || 0}%`}
                  trend="3% vs last week"
                  trendUp
                />
                <StatCard
                  icon="💰"
                  label="Monthly Revenue"
                  value={`$${(stats?.revenue || 0).toLocaleString()}`}
                  trend={stats?.revenueChange}
                  trendUp={stats?.revenueChange?.startsWith('+')}
                />
                <StatCard
                  icon="🔐"
                  label="Locks Online"
                  value={`${stats?.locksOnline || 0}/22`}
                />
              </div>

              {/* Two Column Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Today's Schedule */}
                <div style={{
                  background: COLORS.white,
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: COLORS.charcoal }}>
                      Today's Schedule
                    </h2>
                    <button
                      onClick={() => setCurrentRoute('schedule')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: COLORS.maroon,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      View All →
                    </button>
                  </div>
                  {todaySchedule.map((item, i) => (
                    <ScheduleItem key={i} {...item} />
                  ))}
                </div>

                {/* Quick Actions */}
                <div style={{
                  background: COLORS.white,
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: COLORS.charcoal, marginBottom: 16 }}>
                    Quick Actions
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { icon: '➕', label: 'New Booking', color: COLORS.maroon },
                      { icon: '🔑', label: 'Generate Code', color: COLORS.gold },
                      { icon: '📨', label: 'Send Message', color: '#4CAF50' },
                      { icon: '📊', label: 'View Reports', color: '#2196F3' },
                      { icon: '👤', label: 'Add Cleaner', color: '#9C27B0' },
                      { icon: '⚙️', label: 'Settings', color: '#607D8B' },
                    ].map((action, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 16,
                          borderRadius: 12,
                          border: '1px solid #EEE',
                          background: COLORS.white,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: action.color + '15',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                        }}>
                          {action.icon}
                        </span>
                        <span style={{ fontWeight: 500, color: COLORS.charcoal }}>
                          {action.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* App Info Footer */}
              {appInfo && (
                <div style={{
                  marginTop: 32,
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#999',
                }}>
                  Right at Home BnB Desktop v{appInfo.version} • {appInfo.platform}
                </div>
              )}
            </motion.div>
          )}

          {currentRoute !== 'dashboard' && (
            <motion.div
              key={currentRoute}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ textAlign: 'center', paddingTop: 100 }}
            >
              <div style={{ fontSize: 64, marginBottom: 20 }}>
                {navigation.find(n => n.id === currentRoute)?.icon || '📋'}
              </div>
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 24,
                color: COLORS.maroon,
                marginBottom: 8,
              }}>
                {navigation.find(n => n.id === currentRoute)?.label || 'Page'}
              </h2>
              <p style={{ color: '#666' }}>
                This section would load the {currentRoute} view from the web app
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Mount React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
