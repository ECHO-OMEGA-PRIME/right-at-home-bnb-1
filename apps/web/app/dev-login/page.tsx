'use client';

/**
 * Right at Home BnB - Developer Login Page
 * Quick login as different roles for testing purposes
 *
 * TEST ACCOUNTS:
 * - Guest: Browse properties, make bookings
 * - Cleaning Crew: Maria Rodriguez - cleaning jobs, checklists, photo uploads
 * - Pool Tech: Lisa Hernandez - pool schedule, chemical logs, equipment
 * - Maintenance: Carlos Gutierrez - work orders, repairs, inspections
 * - Yard Crew: Juan Martinez - mowing schedule, landscaping, seasonal tasks
 * - Admin: Full management access
 * - Owner: Steven Palma - Full access including financials
 *
 * Password for all: RightAtHome2026!
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  User, Shield, Crown, ArrowRight, Code, Lock,
  Sparkles, Wrench, Droplets, TreePine, Waves,
} from 'lucide-react';
import toast from 'react-hot-toast';

type WorkerType = 'cleaner' | 'pool' | 'maintenance' | 'yard';
type UserRole = 'guest' | 'worker' | 'admin' | 'owner';

interface DevUser {
  role: UserRole;
  workerType?: WorkerType;
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
    workerType: 'cleaner',
    name: 'Bree Belleville',
    email: 'bree@rah-midland.com',
    description: 'Lead cleaner — turnover cleanings, deep cleans, inspections',
    icon: Sparkles,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500',
    permissions: ['Cleaning Jobs', 'Photo Upload', 'Checklists', 'Supply Requests'],
  },
  {
    role: 'worker',
    workerType: 'pool',
    name: 'Lisa Hernandez',
    email: 'lisa@rah-midland.com',
    description: 'Pool technician — chemical testing, equipment, maintenance',
    icon: Waves,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-500',
    permissions: ['Pool Schedule', 'Chemical Logs', 'Equipment Status', 'Supply Orders'],
  },
  {
    role: 'worker',
    workerType: 'maintenance',
    name: 'Carlos Gutierrez',
    email: 'carlos@rah-midland.com',
    description: 'Maintenance tech — repairs, HVAC, plumbing, electrical',
    icon: Wrench,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500',
    permissions: ['Work Orders', 'Repair History', 'Parts Inventory', 'Inspections'],
  },
  {
    role: 'worker',
    workerType: 'yard',
    name: 'Juan Martinez',
    email: 'juan@rah-midland.com',
    description: 'Yard crew lead — mowing, landscaping, seasonal cleanup',
    icon: TreePine,
    color: 'text-green-600',
    bgColor: 'bg-green-600',
    permissions: ['Mow Schedule', 'Landscaping Tasks', 'Equipment Log', 'Before/After Photos'],
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDevLogin = async (index: number) => {
    setIsLoading(true);
    const devUser = DEV_USERS[index];

    const mockUser = {
      uid: `dev_${devUser.role}_${devUser.workerType || 'general'}_${Date.now()}`,
      email: devUser.email,
      displayName: devUser.name,
      photoURL: null,
      role: devUser.role,
      workerType: devUser.workerType || null,
      isDevMode: true,
      properties: devUser.role === 'worker' ? ['prop_1', 'prop_2', 'prop_3', 'prop_4', 'prop_5'] : undefined,
      isOwner: devUser.role === 'owner',
      isActiveWorker: devUser.role === 'worker',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    localStorage.setItem('dev_user', JSON.stringify(mockUser));
    localStorage.setItem('user_role', devUser.role);
    localStorage.setItem('worker_type', devUser.workerType || '');
    localStorage.setItem('dev_mode', 'true');

    // Set auth cookie for middleware
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `rah-auth-token=dev_${devUser.role}_${devUser.workerType || 'general'}; path=/; max-age=${maxAge}; SameSite=Lax`;

    await new Promise(resolve => setTimeout(resolve, 400));

    toast.success(`Logged in as ${devUser.name}`);
    router.push('/dashboard');
    setIsLoading(false);
  };

  const handlePasswordLogin = () => {
    if (password !== DEV_PASSWORD) {
      toast.error('Invalid developer password');
      return;
    }
    if (selectedIndex === null) {
      toast.error('Please select a role first');
      return;
    }
    handleDevLogin(selectedIndex);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a0a] via-[#2d1515] to-[#1a0a0a] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl"
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
              <p className="text-[#C4A777] text-sm">Right at Home BnB — Test Mode</p>
            </div>
          </div>
          <p className="text-white/60 max-w-md mx-auto">
            Select a role to test different user experiences. Each role has a tailored dashboard.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
          {DEV_USERS.map((user, idx) => {
            const Icon = user.icon;
            const isSelected = selectedIndex === idx;

            return (
              <motion.button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
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
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${user.bgColor} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white truncate">{user.name}</h3>
                      <p className={`text-xs font-medium ${user.color}`}>
                        {user.workerType ? user.workerType.toUpperCase() : user.role.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <p className="text-white/50 text-xs mt-2 line-clamp-2">{user.description}</p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {user.permissions.slice(0, 3).map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-white/70"
                      >
                        {perm}
                      </span>
                    ))}
                    {user.permissions.length > 3 && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-white/50">
                        +{user.permissions.length - 3}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] text-white/30">{user.email}</p>
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter developer password"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#C4A777]"
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                />
              </div>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-white/40 mt-2">Dev mode active</p>
              )}
            </div>

            <div className="flex items-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePasswordLogin}
                disabled={selectedIndex === null || isLoading}
                className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  selectedIndex !== null && !isLoading
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
                    Login as {selectedIndex !== null ? DEV_USERS[selectedIndex].name.split(' ')[0] : '...'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-sm mb-3">Quick Access (Development Only)</p>
          <div className="flex flex-wrap justify-center gap-2">
            {DEV_USERS.map((user, idx) => (
              <button
                key={idx}
                onClick={() => handleDevLogin(idx)}
                disabled={isLoading}
                className="px-3 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all"
              >
                {user.workerType ? `${user.workerType}` : user.role}
              </button>
            ))}
          </div>
        </div>

        {/* Back to Login */}
        <div className="mt-8 text-center">
          <a href="/login" className="text-[#C4A777] hover:text-white text-sm transition-colors">
            ← Back to Regular Login
          </a>
        </div>
      </motion.div>
    </div>
  );
}
