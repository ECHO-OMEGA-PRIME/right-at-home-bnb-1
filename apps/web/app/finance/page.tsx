'use client';

/**
 * Right at Home BnB - Financial Dashboard
 * CLEANED VERSION - No mock financial data
 * Shows empty states until real data is connected
 * 
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Midland, TX
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  DollarSign, TrendingUp, BarChart3, PieChart,
  Calendar, Download, ArrowUpRight, ArrowDownRight,
  Receipt, Building2, Target, ChevronRight,
  Plus, FileText, AlertCircle, RefreshCw, Home,
  Phone, Mail
} from 'lucide-react';
import { properties as propertyKnowledge } from '@/lib/property-knowledge';
import { CONTACT_INFO, initiateCall, initiateEmail } from '@/lib/demo-mode';
import DashboardShell from '@/components/layout/DashboardShell';

// Types
type TimeRange = 'monthly' | 'quarterly' | 'annual';

export default function FinanceDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [selectedYear] = useState<number>(new Date().getFullYear());

  return (
    <DashboardShell>
      <div className="min-h-screen bg-[#F5F5F0]">
        {/* Header */}
        <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                  Financial Overview
                </h1>
                <p className="text-[#2D2D2D]/60 mt-1">
                  {propertyKnowledge.length} properties • {selectedYear}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Time Range Toggle */}
                <div className="flex bg-[#F5F5F0] rounded-lg p-1">
                  {(['monthly', 'quarterly', 'annual'] as TimeRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                        timeRange === range
                          ? 'bg-[#500000] text-white'
                          : 'text-[#2D2D2D]/60 hover:text-[#500000]'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Notice Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8"
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">Financial Data Connection Required</h3>
                <p className="text-amber-700 text-sm mt-1">
                  Connect your booking platforms (Vrbo, Airbnb) to see real-time financial data.
                  Until connected, this dashboard will show placeholder information.
                </p>
                <div className="flex gap-3 mt-4">
                  <Link href="/settings">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium"
                    >
                      Connect Platforms
                    </motion.button>
                  </Link>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={initiateCall}
                    className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    Contact Support
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Empty State Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <EmptyMetricCard
              label="Total Revenue"
              icon={DollarSign}
              color="text-emerald-600"
              bgColor="bg-emerald-100"
            />
            <EmptyMetricCard
              label="Total Expenses"
              icon={ArrowDownRight}
              color="text-red-600"
              bgColor="bg-red-100"
            />
            <EmptyMetricCard
              label="Net Profit"
              icon={TrendingUp}
              color="text-[#500000]"
              bgColor="bg-[#500000]/10"
            />
            <EmptyMetricCard
              label="Profit Margin"
              icon={Target}
              color="text-[#C4A777]"
              bgColor="bg-[#C4A777]/20"
            />
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Revenue Chart Placeholder */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                    Revenue Overview
                  </h2>
                  <BarChart3 className="w-5 h-5 text-[#2D2D2D]/30" />
                </div>

                <div className="h-64 flex items-center justify-center bg-[#F5F5F0] rounded-xl">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-[#2D2D2D]/20 mx-auto mb-4" />
                    <p className="text-[#2D2D2D]/50 text-sm">
                      Revenue data will appear here once platforms are connected
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Properties Table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                    Property Portfolio
                  </h2>
                  <Link href="/properties">
                    <span className="text-sm text-[#500000] hover:underline flex items-center gap-1">
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2D2D2D]/10">
                        <th className="text-left py-3 px-4 text-sm font-medium text-[#2D2D2D]/60">Property</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[#2D2D2D]/60">Beds</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[#2D2D2D]/60">Baths</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[#2D2D2D]/60">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {propertyKnowledge.slice(0, 8).map((property) => (
                        <tr key={property.id} className="border-b border-[#2D2D2D]/5 hover:bg-[#F5F5F0]/50">
                          <td className="py-3 px-4">
                            <Link href={`/properties/${property.id}`}>
                              <span className="font-medium text-[#2D2D2D] hover:text-[#500000]">
                                {property.nickname || property.name}
                              </span>
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-[#2D2D2D]/70">{property.bedrooms}</td>
                          <td className="py-3 px-4 text-[#2D2D2D]/70">{property.bathrooms}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {propertyKnowledge.length > 8 && (
                  <div className="mt-4 text-center">
                    <Link href="/properties">
                      <span className="text-sm text-[#500000] hover:underline">
                        View all {propertyKnowledge.length} properties
                      </span>
                    </Link>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              
              {/* Contact Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white"
              >
                <h3 className="font-['Playfair_Display'] font-semibold mb-4">
                  Need Financial Help?
                </h3>
                <p className="text-white/70 text-sm mb-4">
                  Contact Steven for assistance with financial reporting, tax documents, or platform connections.
                </p>

                <div className="space-y-2">
                  <motion.button
                    whileHover={{ x: 4 }}
                    onClick={initiateCall}
                    className="w-full flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="font-medium flex-1 text-left">Call {CONTACT_INFO.phoneDisplay}</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    whileHover={{ x: 4 }}
                    onClick={() => initiateEmail('Financial Dashboard Help')}
                    className="w-full flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    <span className="font-medium flex-1 text-left">Send Email</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
              >
                <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
                  Quick Actions
                </h3>

                <div className="space-y-2">
                  {[
                    { label: 'Add Expense', icon: Plus, href: '#', disabled: true },
                    { label: 'Export Report', icon: Download, href: '#', disabled: true },
                    { label: 'View Tax Documents', icon: FileText, href: '#', disabled: true },
                    { label: 'Manage Properties', icon: Building2, href: '/properties', disabled: false },
                  ].map((action) => (
                    action.disabled ? (
                      <div
                        key={action.label}
                        className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl opacity-50 cursor-not-allowed"
                      >
                        <action.icon className="w-5 h-5 text-[#2D2D2D]/50" />
                        <span className="text-sm text-[#2D2D2D]/50">{action.label}</span>
                        <span className="ml-auto text-xs text-[#2D2D2D]/30">Coming soon</span>
                      </div>
                    ) : (
                      <Link key={action.label} href={action.href}>
                        <motion.div
                          whileHover={{ x: 4 }}
                          className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/5 transition-colors cursor-pointer"
                        >
                          <action.icon className="w-5 h-5 text-[#500000]" />
                          <span className="text-sm font-medium text-[#2D2D2D]">{action.label}</span>
                          <ChevronRight className="w-4 h-4 ml-auto text-[#2D2D2D]/30" />
                        </motion.div>
                      </Link>
                    )
                  ))}
                </div>
              </motion.div>

              {/* Expense Categories Placeholder */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
              >
                <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
                  Expense Breakdown
                </h3>

                <div className="h-40 flex items-center justify-center bg-[#F5F5F0] rounded-xl">
                  <div className="text-center">
                    <PieChart className="w-10 h-10 text-[#2D2D2D]/20 mx-auto mb-2" />
                    <p className="text-[#2D2D2D]/50 text-xs">
                      Connect platforms to view expenses
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </DashboardShell>
  );
}

// Empty Metric Card
function EmptyMetricCard({
  label,
  icon: Icon,
  color,
  bgColor,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-[#2D2D2D]/5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]/30">
        --
      </div>
      <div className="text-sm text-[#2D2D2D]/60">{label}</div>
    </motion.div>
  );
}
