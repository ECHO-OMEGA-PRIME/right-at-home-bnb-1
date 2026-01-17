'use client';

/**
 * Right at Home BnB - VRBO Management Page
 * Admin interface for managing VRBO channel integration
 * @author ECHO OMEGA PRIME
 */

import { useState, useEffect } from 'react';
import {
  VRBOListing,
  VRBOBooking,
  VRBOStats,
  VRBOSyncLog,
  VRBO_SETUP_GUIDE,
  getVRBOListings,
  getVRBOStats,
  getUpcomingVRBOBookings,
  getSyncLogs,
  syncFromVRBO,
  registerVRBOProperty,
  disconnectVRBOProperty,
} from '@/lib/vrbo-integration';

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-100 text-green-800',
  disconnected: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800',
};

export default function VRBOManagementPage() {
  const [listings, setListings] = useState<VRBOListing[]>([]);
  const [stats, setStats] = useState<VRBOStats | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<VRBOBooking[]>([]);
  const [syncLogs, setSyncLogs] = useState<VRBOSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Form state for adding new listing
  const [newListing, setNewListing] = useState({
    propertyId: '',
    vrboListingId: '',
    icalUrl: '',
    title: '',
    nightlyRate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [listingsData, statsData, bookingsData] = await Promise.all([
        getVRBOListings(),
        getVRBOStats(),
        getUpcomingVRBOBookings(10),
      ]);
      setListings(listingsData);
      setStats(statsData);
      setUpcomingBookings(bookingsData);
    } catch (error) {
      console.error('Failed to load VRBO data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync(listingId: string) {
    try {
      setSyncing(listingId);
      const result = await syncFromVRBO(listingId);
      if (result.success) {
        alert(`Synced ${result.bookingsImported} bookings successfully!`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
      await loadData();
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(null);
    }
  }

  async function handleAddListing() {
    if (!newListing.propertyId || !newListing.vrboListingId || !newListing.icalUrl) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await registerVRBOProperty(
        newListing.propertyId,
        newListing.vrboListingId,
        newListing.icalUrl,
        {
          title: newListing.title || undefined,
          nightlyRate: newListing.nightlyRate ? parseFloat(newListing.nightlyRate) : undefined,
        }
      );
      setShowAddModal(false);
      setNewListing({ propertyId: '', vrboListingId: '', icalUrl: '', title: '', nightlyRate: '' });
      await loadData();
      alert('VRBO listing added successfully!');
    } catch (error) {
      console.error('Failed to add listing:', error);
      alert('Failed to add listing. Please try again.');
    }
  }

  async function handleDisconnect(listingId: string) {
    if (!confirm('Are you sure you want to disconnect this listing?')) return;

    try {
      await disconnectVRBOProperty(listingId);
      await loadData();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('Failed to disconnect. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#500000] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading VRBO Integration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-[#2D2D2D]">VRBO Integration</h1>
            <p className="text-gray-600 mt-1">Manage your VRBO channel connections</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowGuide(true)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Setup Guide
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[#500000] text-white rounded-lg hover:bg-[#600000]"
            >
              + Add VRBO Listing
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Connected Listings"
              value={stats.connectedListings}
              icon="link"
              color="green"
            />
            <StatCard
              title="Total VRBO Bookings"
              value={stats.totalBookings}
              icon="calendar"
              color="blue"
            />
            <StatCard
              title="Upcoming Bookings"
              value={stats.upcomingVRBOBookings}
              icon="clock"
              color="purple"
            />
            <StatCard
              title="Sync Success Rate"
              value={`${stats.syncSuccessRate}%`}
              icon="check"
              color="yellow"
            />
          </div>
        )}

        {/* Listings Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-[#2D2D2D]">Connected Listings</h2>
          </div>

          {listings.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">{"🏠"}</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No VRBO Listings Connected</h3>
              <p className="text-gray-600 mb-4">Connect your first VRBO listing to start syncing calendars</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[#500000] text-white rounded-lg hover:bg-[#600000]"
              >
                Add Your First Listing
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VRBO ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sync</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bookings</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{listing.title || `Property ${listing.propertyId}`}</div>
                          <div className="text-sm text-gray-500">ID: {listing.propertyId}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={listing.vrboUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#500000] hover:underline"
                        >
                          {listing.vrboListingId}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[listing.connectionStatus]}`}>
                          {listing.connectionStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {listing.lastSyncTime
                          ? new Date(listing.lastSyncTime).toLocaleString()
                          : 'Never'}
                        {listing.lastSyncStatus && (
                          <span className={`ml-2 px-2 py-0.5 rounded text-xs ${STATUS_COLORS[listing.lastSyncStatus]}`}>
                            {listing.lastSyncStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {listing.lastSyncBookings ?? '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSync(listing.id)}
                            disabled={syncing === listing.id}
                            className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                          >
                            {syncing === listing.id ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(listing.icalExportUrl)}
                            className="px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                          >
                            Copy Export URL
                          </button>
                          <button
                            onClick={() => handleDisconnect(listing.id)}
                            className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                          >
                            Disconnect
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        {upcomingBookings.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-[#2D2D2D]">Upcoming VRBO Bookings</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {upcomingBookings.map((booking) => (
                <div key={booking.uid} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{booking.guestName || 'Guest'}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
                    </div>
                    {booking.confirmationCode && (
                      <div className="text-xs text-gray-500">Confirmation: {booking.confirmationCode}</div>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[booking.status] || 'bg-gray-100'}`}>
                    {booking.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Listing Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-semibold mb-4">Add VRBO Listing</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property ID *</label>
                  <input
                    type="text"
                    value={newListing.propertyId}
                    onChange={(e) => setNewListing({ ...newListing, propertyId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                    placeholder="Your internal property ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VRBO Listing ID *</label>
                  <input
                    type="text"
                    value={newListing.vrboListingId}
                    onChange={(e) => setNewListing({ ...newListing, vrboListingId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                    placeholder="e.g., 1234567"
                  />
                  <p className="text-xs text-gray-500 mt-1">Find this in your VRBO dashboard URL</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VRBO iCal Export URL *</label>
                  <input
                    type="url"
                    value={newListing.icalUrl}
                    onChange={(e) => setNewListing({ ...newListing, icalUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                    placeholder="https://www.vrbo.com/icalendar/..."
                  />
                  <p className="text-xs text-gray-500 mt-1">VRBO Dashboard &rarr; Calendar &rarr; Export</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Title</label>
                  <input
                    type="text"
                    value={newListing.title}
                    onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                    placeholder="e.g., Castleford Estate"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nightly Rate ($)</label>
                  <input
                    type="number"
                    value={newListing.nightlyRate}
                    onChange={(e) => setNewListing({ ...newListing, nightlyRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                    placeholder="150"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddListing}
                  className="px-4 py-2 bg-[#500000] text-white rounded-lg hover:bg-[#600000]"
                >
                  Add Listing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Setup Guide Modal */}
        {showGuide && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl m-4 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">VRBO Setup Guide</h2>
                <button onClick={() => setShowGuide(false)} className="text-gray-500 hover:text-gray-700">
                  Close
                </button>
              </div>

              {/* iCal Sync Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-[#500000] mb-2">{VRBO_SETUP_GUIDE.icalSync.title}</h3>
                <p className="text-gray-600 mb-4">{VRBO_SETUP_GUIDE.icalSync.description}</p>

                <div className="space-y-4">
                  {VRBO_SETUP_GUIDE.icalSync.steps.map((step) => (
                    <div key={step.step} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full bg-[#500000] text-white text-sm flex items-center justify-center">
                          {step.step}
                        </span>
                        <h4 className="font-medium">{step.title}</h4>
                      </div>
                      <ul className="list-disc list-inside text-sm text-gray-600 ml-9 space-y-1">
                        {step.instructions.map((inst, i) => (
                          <li key={i}>{inst}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full API Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-blue-700 mb-2">{VRBO_SETUP_GUIDE.fullAPI.title}</h3>
                <p className="text-gray-600 mb-4">{VRBO_SETUP_GUIDE.fullAPI.description}</p>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Benefits</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {VRBO_SETUP_GUIDE.fullAPI.benefits.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Requirements</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {VRBO_SETUP_GUIDE.fullAPI.requirements.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Ready for real-time sync?</strong><br />
                    Apply at: <a href={VRBO_SETUP_GUIDE.fullAPI.howToApply} target="_blank" rel="noopener noreferrer" className="underline">{VRBO_SETUP_GUIDE.fullAPI.howToApply}</a><br />
                    Contact: <a href={`mailto:${VRBO_SETUP_GUIDE.fullAPI.contact}`} className="underline">{VRBO_SETUP_GUIDE.fullAPI.contact}</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${colorClasses[color]} flex items-center justify-center`}>
          {icon === 'link' && <span>{"🔗"}</span>}
          {icon === 'calendar' && <span>{"📅"}</span>}
          {icon === 'clock' && <span>{"⏰"}</span>}
          {icon === 'check' && <span>{"✓"}</span>}
        </div>
      </div>
    </div>
  );
}
