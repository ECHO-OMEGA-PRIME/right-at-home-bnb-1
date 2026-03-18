'use client';

/**
 * Right at Home BnB - Developer Login Page
 * Quick login as different roles for testing purposes
 *
 * TEST ACCOUNTS:
 * - Guest: Limited access, can browse properties and make bookings
 * - Worker: Cleaner/maintenance access, can view assigned jobs
 * - Admin: Full management access
 * - Owner: Steven Palma - Full access including financials
 *
 * Password for all: RightAtHome2026!
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  User, Users, Shield, Crown, ArrowRight, Code, Lock,
  Building2, Sparkles, DollarSign, Calendar, Key, Wrench
} from 'lucide-react';
import toast from 'react-hot-toast';

type UserRole = 'guest' | 'worker' | 'admin' | 'owner';

interface DevUser {
  role: UserRole;
  name: string;
  email: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  permissions: string[];
}

const DEV_USERS: DevUser[] = [
  {
    role: 'guest',
    name: 'Guest User',
    email: 'guest@rah-midland.com',
    description: 'Browse properties, make bookings, use AI Concierge',
    icon: User,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500',
    permissions: ['View Properties', 'Make Bookings', 'AI Concierge', 'Messages'],
  },
  {
    role: 'worker',
    name: 'Maria Rodriguez',
    email: 'maria@rah-midland.com',
    description: 'Cleaner with assigned properties and job schedule',
    icon: Sparkles,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500',
    permissions: ['Cleaning Jobs', 'Photo Upload', 'Time Tracking', 'Maintenance Flags'],
  },
  {
    role: 'admin',
    name: 'Admin User',
    email: 'admin@rah-midland.com',
    description: 'Full management access without financial data',
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500',
    permissions: ['All Properties', 'Bookings', 'Workers', 'Smart Locks', 'Messages'],
  },
  {
    role: 'owner',
    name: 'Steven Palma',
    email: 'steven@rah-midland.com',
    description: 'Property owner with full access including financials',
    icon: Crown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500',
    permissions: ['Everything', 'Financials', 'Reports', 'Settings', 'User Management'],
  },
];

const DEV_PASSWORD = 'RightAtHome2026!';

export default function DevLoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDevLogin = async (role: UserRole) => {
    setIsLoading(true);

    const devUser = DEV_USERS.find(u => u.role === role);
    if (!devUser) {
      toast.error('Invalid role selected');
      setIsLoading(false);
      return;
    }

    // Store dev user in localStorage
    const mockUser = {
      uid: `dev_${role}_${Date.now()}`,
      email: devUser.email,
      displayName: devUser.name,
      photoURL: null,
      role: role,
      isDevMode: true,
      properties: role === 'worker' ? ['prop_1', 'prop_2', 'prop_3'] : undefined,
      isOwner: role === 'owner',
      isActiveWorker: role === 'worker',
      workerType: role === 'worker' ? 'cleaner' : undefined,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    localStorage.setItem('dev_user', JSON.stringify(mockUser));
    localStorage.setItem('user_role', role);
    localStorage.setItem('dev_mode', 'true');

    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 500));

    toast.success(`Logged in as ${devUser.name} (${role})`);
    router.push('/dashboard');
    setIsLoading(false);
  };

  const handlePasswordLogin = () => {
    if (password !== DEV_PASSWORD) {
      toast.error('Invalid developer password');
      return;
    }
    if (!selectedRole) {
      toast.error('Please select a role first');
      return;
    }
    handleDevLogin(selectedRole);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a0a] via-[#2d1515] to-[#1a0a0a] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#500000] flex items-center justify-center">
              <Code className="w-6 h-6 text-[#C4A777]" />
            </div>
            <div>
              <h1 className="text-3xl font-['Playfair_Display'] font-bold text-white">
                Developer Login
              </h1>
              <p className="text-[#C4A777] text-sm">Right at Home BnB - Test Mode</p>
            </div>
          </div>
          <p className="text-white/60 max-w-md mx-auto">
            Select a role to test different user experiences. Each role has specific permissions and views.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {DEV_USERS.map((user) => {
            const Icon = user.icon;
            const isSelected = selectedRole === user.role;

            return (
              <motion.button
                key={user.role}
                onClick={() => setSelectedRole(user.role)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-[#C4A777] bg-white/10'
                    : 'border-white/10 bg-white/5 hover:border-white/30'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="selected"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#500000]/30 to-transparent"
                  />
                )}

                <div className="relative">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${user.bgColor} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{user.name}</h3>
                      <p className={`text-sm font-medium ${user.color}`}>{user.role.toUpperCase()}</p>
                      <p className="text-white/60 text-sm mt-1">{user.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {user.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-1 text-xs rounded-full bg-white/10 text-white/80"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-white/40">{user.email}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Password Input & Login Button */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-white/60 mb-2">
                Developer Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter developer password"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#C4A777]"
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                />
              </div>
              <p className="text-xs text-white/40 mt-2">
                Hint: RightAtHome2026!
              </p>
            </div>

            <div className="flex items-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePasswordLogin}
                disabled={!selectedRole || isLoading}
                className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  selectedRole && !isLoading
                    ? 'bg-[#500000] text-white hover:bg-[#722F37]'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    Login as {selectedRole ? DEV_USERS.find(u => u.role === selectedRole)?.name.split(' ')[0] : '...'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Quick Access (No Password) */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-sm mb-3">Quick Access (Development Only)</p>
          <div className="flex flex-wrap justify-center gap-2">
            {DEV_USERS.map((user) => (
              <button
                key={user.role}
                onClick={() => handleDevLogin(user.role)}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all"
              >
                Quick: {user.role}
              </button>
            ))}
          </div>
        </div>

        {/* Back to Login */}
        <div className="mt-8 text-center">
          <a
            href="/login"
            className="text-[#C4A777] hover:text-white text-sm transition-colors"
          >
            ← Back to Regular Login
          </a>
        </div>
      </motion.div>
    </div>
  );
}
