import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  Star,
  Calendar,
  DollarSign,
  MoreVertical,
  Edit2,
  Trash2,
  MessageSquare,
  Tag,
  User,
  Download,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { format } from 'date-fns';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Guests() {
  const { guests, bookings, properties } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredGuests = guests.filter(
    (guest) =>
      guest.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getGuestBookings = (guestId: string) =>
    bookings.filter((b) => b.guestId === guestId);

  const exportToExcel = async () => {
    try {
      const result = await window.electronAPI.dialog.showSaveDialog({
        title: 'Export Guests',
        defaultPath: `guests-${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (!result.canceled && result.filePath) {
        // In real app, use xlsx library to create workbook
        await window.electronAPI.notification.show(
          'Export Complete',
          'Guest data exported successfully'
        );
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Guest CRM</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage {guests.length} guests and their booking history
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Guest
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search guests by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-xl px-4">
              <Filter className="w-5 h-5" />
              Filter
            </button>
            <button className="btn-ghost flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-xl px-4">
              <Tag className="w-5 h-5" />
              Tags
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Guests</p>
          <p className="text-2xl font-bold mt-1">{guests.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">VIP Guests</p>
          <p className="text-2xl font-bold mt-1 text-maroon-900 dark:text-maroon-400">
            {guests.filter((g) => g.tags.includes('VIP')).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Repeat Guests</p>
          <p className="text-2xl font-bold mt-1 text-green-600">
            {guests.filter((g) => g.totalBookings > 1).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
          <p className="text-2xl font-bold mt-1">
            ${guests.reduce((sum, g) => sum + g.totalSpent, 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Guest List */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="lg:col-span-2 card overflow-hidden"
        >
          <table className="table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Contact</th>
                <th>Bookings</th>
                <th>Total Spent</th>
                <th>Rating</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map((guest) => (
                <motion.tr
                  key={guest.id}
                  variants={item}
                  className={`cursor-pointer ${
                    selectedGuest === guest.id ? 'bg-maroon-50 dark:bg-maroon-900/20' : ''
                  }`}
                  onClick={() => setSelectedGuest(guest.id)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-maroon-900 dark:text-maroon-400" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {guest.firstName} {guest.lastName}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {guest.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs bg-maroon-100 dark:bg-maroon-900/30 text-maroon-900 dark:text-maroon-400 px-2 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-sm">{guest.email}</p>
                    <p className="text-sm text-gray-500">{guest.phone}</p>
                  </td>
                  <td>
                    <span className="font-semibold">{guest.totalBookings}</span>
                  </td>
                  <td>
                    <span className="font-semibold text-maroon-900 dark:text-maroon-400">
                      ${guest.totalSpent.toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span>{guest.rating}</span>
                    </div>
                  </td>
                  <td>
                    <div className="relative group">
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Guest Detail Panel */}
        <div className="card p-6">
          {selectedGuest ? (
            <GuestDetail
              guest={guests.find((g) => g.id === selectedGuest)!}
              bookings={getGuestBookings(selectedGuest)}
              properties={properties}
            />
          ) : (
            <div className="text-center py-12 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a guest to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Guest Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-display font-semibold mb-6">
                Add New Guest
              </h2>

              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input type="text" className="input" placeholder="John" />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input type="text" className="input" placeholder="Smith" />
                  </div>
                </div>

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="(432) 555-0100"
                  />
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    rows={3}
                    className="input"
                    placeholder="Any special notes about this guest..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    Add Guest
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GuestDetail({
  guest,
  bookings,
  properties,
}: {
  guest: any;
  bookings: any[];
  properties: any[];
}) {
  return (
    <div>
      {/* Guest Header */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-10 h-10 text-maroon-900 dark:text-maroon-400" />
        </div>
        <h3 className="text-xl font-display font-semibold">
          {guest.firstName} {guest.lastName}
        </h3>
        <div className="flex justify-center gap-1 mt-2">
          {guest.tags.map((tag: string) => (
            <span key={tag} className="badge badge-maroon">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-3 mb-6">
        <a
          href={`mailto:${guest.email}`}
          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Mail className="w-5 h-5 text-gray-400" />
          <span className="text-sm">{guest.email}</span>
        </a>
        <a
          href={`tel:${guest.phone}`}
          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Phone className="w-5 h-5 text-gray-400" />
          <span className="text-sm">{guest.phone}</span>
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <Calendar className="w-5 h-5 mx-auto mb-2 text-gray-400" />
          <p className="text-2xl font-bold">{guest.totalBookings}</p>
          <p className="text-xs text-gray-500">Bookings</p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <DollarSign className="w-5 h-5 mx-auto mb-2 text-gray-400" />
          <p className="text-2xl font-bold">${guest.totalSpent}</p>
          <p className="text-xs text-gray-500">Total Spent</p>
        </div>
      </div>

      {/* Booking History */}
      <div>
        <h4 className="font-semibold mb-3">Booking History</h4>
        <div className="space-y-2">
          {bookings.length > 0 ? (
            bookings.map((booking) => {
              const property = properties.find(
                (p) => p.id === booking.propertyId
              );
              return (
                <div
                  key={booking.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                >
                  <p className="font-medium text-sm">
                    {property?.name || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(booking.checkIn), 'MMM d')} -{' '}
                    {format(new Date(booking.checkOut), 'MMM d, yyyy')}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500">No bookings yet</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-6">
        <button className="btn-primary flex-1 flex items-center justify-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Message
        </button>
        <button className="btn-secondary px-4">
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
