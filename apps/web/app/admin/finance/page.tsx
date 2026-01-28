'use client';

/**
 * Right at Home BnB - Admin Financial Dashboard ("Financial God View")
 * Complete portfolio financial management for Steven Palma's 22 properties
 *
 * Features:
 * 1. Overview Cards: Revenue, Expenses, Net Profit, Occupancy, RevPAR
 * 2. Property Financial Table with sorting/filtering
 * 3. Expense Breakdown Charts (Pie & Stacked Bar)
 * 4. Monthly Trend Graph (12 months)
 * 5. Gap-Filler Widget for booking gaps
 * 6. Tax Export Section (Schedule E)
 * 7. Weekly Payout Report
 *
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Midland, TX
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart,
  Calendar, Download, Filter, ArrowUpRight, ArrowDownRight,
  Building2, Wallet, Target, ChevronRight, ChevronDown, ChevronUp,
  FileText, FileSpreadsheet, Home, Percent, BedDouble, CalendarDays,
  AlertTriangle, Sparkles, Tag, Clock, Users, RefreshCw, Printer,
  Eye, EyeOff, SortAsc, SortDesc, X, Check, DollarSign as Dollar
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import DashboardShell from '@/components/layout/DashboardShell';

// ============================================
// TYPES
// ============================================

interface Property {
  id: string;
  name: string;
  address: string;
  bedrooms: number;
  nightlyRate: number;
}

interface PropertyFinancials {
  propertyId: string;
  propertyName: string;
  grossRevenue: number;
  expenses: number;
  netProfit: number;
  occupancyPercent: number;
  profitMarginPercent: number;
  totalNights: number;
  bookedNights: number;
  avgDailyRate: number;
  revPAR: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
  taxCategory: string;
}

interface MonthlyData {
  month: string;
  monthLabel: string;
  revenue: number;
  expenses: number;
  netProfit: number;
}

interface BookingGap {
  propertyId: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  gapDays: number;
  suggestedDiscount: number;
  potentialRevenue: number;
}

interface WeeklyPayout {
  propertyId: string;
  propertyName: string;
  grossBookings: number;
  platformFees: number;
  ownerPayout: number;
  cleaningCosts: number;
  netToOwner: number;
}

type SortField = 'propertyName' | 'grossRevenue' | 'expenses' | 'netProfit' | 'occupancyPercent' | 'profitMarginPercent';
type SortDirection = 'asc' | 'desc';

// ============================================
// MOCK DATA
// ============================================

const MOCK_PROPERTIES: Property[] = [
  { id: 'prop_1', name: 'Castleford Estate', address: '123 Main St', bedrooms: 4, nightlyRate: 225 },
  { id: 'prop_2', name: 'Basin View Cottage', address: '456 Oak Ave', bedrooms: 3, nightlyRate: 195 },
  { id: 'prop_3', name: 'Desert Rose Villa', address: '789 Palm Dr', bedrooms: 3, nightlyRate: 185 },
  { id: 'prop_4', name: 'Petroleum Plaza Suite', address: '321 Energy Blvd', bedrooms: 2, nightlyRate: 165 },
  { id: 'prop_5', name: 'Lone Star Luxury', address: '555 Texas Way', bedrooms: 4, nightlyRate: 245 },
  { id: 'prop_6', name: 'Midland Manor', address: '777 Heritage Ln', bedrooms: 3, nightlyRate: 195 },
  { id: 'prop_7', name: 'Permian Paradise', address: '888 Basin Rd', bedrooms: 5, nightlyRate: 285 },
  { id: 'prop_8', name: 'West Texas Retreat', address: '999 Sunset Dr', bedrooms: 2, nightlyRate: 155 },
  { id: 'prop_9', name: 'Oil Field Oasis', address: '111 Drill Ave', bedrooms: 3, nightlyRate: 175 },
  { id: 'prop_10', name: "Wildcatter's Rest", address: '222 Pioneer St', bedrooms: 4, nightlyRate: 215 },
  { id: 'prop_11', name: 'Lincoln Green Ranch', address: '333 Lincoln Way', bedrooms: 5, nightlyRate: 295 },
  { id: 'prop_12', name: 'Odessa Gateway', address: '444 Gateway Blvd', bedrooms: 2, nightlyRate: 145 },
  { id: 'prop_13', name: 'Big Spring Haven', address: '555 Spring St', bedrooms: 3, nightlyRate: 185 },
  { id: 'prop_14', name: 'Andrews Avenue', address: '666 Andrews Ave', bedrooms: 2, nightlyRate: 155 },
  { id: 'prop_15', name: 'Seminole Suite', address: '777 Seminole Rd', bedrooms: 3, nightlyRate: 175 },
  { id: 'prop_16', name: 'Crane Country', address: '888 Crane Dr', bedrooms: 4, nightlyRate: 225 },
  { id: 'prop_17', name: 'Monahans Mesa', address: '999 Mesa Blvd', bedrooms: 3, nightlyRate: 195 },
  { id: 'prop_18', name: 'Pecos Place', address: '101 Pecos Ave', bedrooms: 2, nightlyRate: 165 },
  { id: 'prop_19', name: 'Fort Stockton Retreat', address: '202 Stockton St', bedrooms: 4, nightlyRate: 235 },
  { id: 'prop_20', name: 'Alpine Escape', address: '303 Alpine Way', bedrooms: 3, nightlyRate: 205 },
  { id: 'prop_21', name: 'Marfa Modern', address: '404 Marfa Rd', bedrooms: 2, nightlyRate: 175 },
  { id: 'prop_22', name: 'Garfield Getaway', address: '505 Garfield Ln', bedrooms: 2, nightlyRate: 145 },
];

// Generate property financials with realistic data
const generatePropertyFinancials = (): PropertyFinancials[] => {
  return MOCK_PROPERTIES.map((prop, index) => {
    const baseOccupancy = 65 + Math.random() * 30; // 65-95%
    const bookedNights = Math.round((baseOccupancy / 100) * 31); // Days in month
    const totalNights = 31;
    const avgDailyRate = prop.nightlyRate * (0.9 + Math.random() * 0.2);
    const grossRevenue = bookedNights * avgDailyRate;
    const expenseRate = 0.18 + Math.random() * 0.12; // 18-30% expense ratio
    const expenses = grossRevenue * expenseRate;
    const netProfit = grossRevenue - expenses;
    const profitMargin = (netProfit / grossRevenue) * 100;
    const revPAR = grossRevenue / totalNights;

    return {
      propertyId: prop.id,
      propertyName: prop.name,
      grossRevenue: Math.round(grossRevenue),
      expenses: Math.round(expenses),
      netProfit: Math.round(netProfit),
      occupancyPercent: Math.round(baseOccupancy),
      profitMarginPercent: Math.round(profitMargin),
      totalNights,
      bookedNights,
      avgDailyRate: Math.round(avgDailyRate),
      revPAR: Math.round(revPAR),
    };
  });
};

// Generate monthly trend data (last 12 months)
const generateMonthlyData = (): MonthlyData[] => {
  const months = [
    'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025',
    'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026'
  ];

  return months.map((monthLabel, index) => {
    const baseRevenue = 85000 + Math.sin(index / 2) * 15000 + Math.random() * 10000;
    const expenses = baseRevenue * (0.22 + Math.random() * 0.08);
    return {
      month: `2025-${String(index + 2).padStart(2, '0')}`,
      monthLabel: monthLabel.split(' ')[0],
      revenue: Math.round(baseRevenue),
      expenses: Math.round(expenses),
      netProfit: Math.round(baseRevenue - expenses),
    };
  });
};

// Generate expense breakdown by tax category
const generateExpenseBreakdown = (totalExpenses: number): ExpenseCategory[] => {
  const categories = [
    { category: 'Cleaning & Turnover', taxCategory: 'Line 7 - Cleaning/Maintenance', percent: 0.32 },
    { category: 'Utilities', taxCategory: 'Line 17 - Utilities', percent: 0.18 },
    { category: 'Maintenance & Repairs', taxCategory: 'Line 14 - Repairs', percent: 0.15 },
    { category: 'Supplies', taxCategory: 'Line 15 - Supplies', percent: 0.12 },
    { category: 'Insurance', taxCategory: 'Line 9 - Insurance', percent: 0.10 },
    { category: 'Property Tax', taxCategory: 'Line 16 - Taxes', percent: 0.08 },
    { category: 'Marketing & Advertising', taxCategory: 'Line 5 - Advertising', percent: 0.03 },
    { category: 'Other', taxCategory: 'Line 19 - Other', percent: 0.02 },
  ];

  return categories.map(cat => ({
    category: cat.category,
    amount: Math.round(totalExpenses * cat.percent),
    percentage: Math.round(cat.percent * 100),
    taxCategory: cat.taxCategory,
  }));
};

// Generate booking gaps
const generateBookingGaps = (): BookingGap[] => {
  const gaps: BookingGap[] = [];
  const today = new Date();

  MOCK_PROPERTIES.slice(0, 8).forEach((prop, index) => {
    if (Math.random() > 0.4) { // 60% chance of having a gap
      const startOffset = 3 + Math.floor(Math.random() * 10);
      const gapDays = 3 + Math.floor(Math.random() * 5);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + startOffset);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + gapDays);

      gaps.push({
        propertyId: prop.id,
        propertyName: prop.name,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        gapDays,
        suggestedDiscount: gapDays >= 5 ? 20 : gapDays >= 4 ? 15 : 10,
        potentialRevenue: prop.nightlyRate * gapDays * 0.85,
      });
    }
  });

  return gaps.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
};

// Generate weekly payout report
const generateWeeklyPayouts = (): WeeklyPayout[] => {
  return MOCK_PROPERTIES.slice(0, 10).map(prop => {
    const grossBookings = Math.round(prop.nightlyRate * (5 + Math.random() * 3) * (2 + Math.random() * 2));
    const platformFees = Math.round(grossBookings * 0.03);
    const cleaningCosts = Math.round(85 + Math.random() * 50) * Math.ceil(Math.random() * 3);
    const ownerPayout = grossBookings - platformFees;
    const netToOwner = ownerPayout - cleaningCosts;

    return {
      propertyId: prop.id,
      propertyName: prop.name,
      grossBookings,
      platformFees,
      ownerPayout,
      cleaningCosts,
      netToOwner,
    };
  });
};

// ============================================
// CHART COLORS
// ============================================

const CHART_COLORS = {
  revenue: '#10B981',
  expenses: '#EF4444',
  netProfit: '#500000',
  occupancy: '#3B82F6',
  primary: '#500000',
  secondary: '#C4A777',
};

const PIE_COLORS = [
  '#500000', '#722F37', '#8B4513', '#2E8B57', '#3B82F6',
  '#8B5CF6', '#F59E0B', '#6B7280'
];

// ============================================
// HELPER COMPONENTS
// ============================================

const StatCard = ({
  title,
  value,
  subValue,
  change,
  changeType = 'neutral',
  icon: Icon,
  prefix = '',
  suffix = ''
}: {
  title: string;
  value: string | number;
  subValue?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: any;
  prefix?: string;
  suffix?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm text-[#2D2D2D]/60 font-medium">{title}</p>
        <p className="text-3xl font-bold text-[#2D2D2D] mt-2 font-display">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </p>
        {subValue && (
          <p className="text-sm text-[#2D2D2D]/50 mt-1">{subValue}</p>
        )}
        {change && (
          <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${
            changeType === 'positive' ? 'text-emerald-600' :
            changeType === 'negative' ? 'text-red-600' : 'text-[#2D2D2D]/50'
          }`}>
            {changeType === 'positive' && <ArrowUpRight className="w-4 h-4" />}
            {changeType === 'negative' && <ArrowDownRight className="w-4 h-4" />}
            {change}
          </div>
        )}
      </div>
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center">
        <Icon className="w-7 h-7 text-[#C4A777]" />
      </div>
    </div>
  </motion.div>
);

const SectionHeader = ({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between mb-6">
    <div>
      <h2 className="text-xl font-bold text-[#2D2D2D] font-display">{title}</h2>
      {subtitle && <p className="text-sm text-[#2D2D2D]/60 mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminFinanceDashboard() {
  // State
  const [dateRange, setDateRange] = useState<'mtd' | 'qtd' | 'ytd'>('mtd');
  const [sortField, setSortField] = useState<SortField>('netProfit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [selectedGap, setSelectedGap] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const propertyFinancials = useMemo(() => generatePropertyFinancials(), []);
  const monthlyData = useMemo(() => generateMonthlyData(), []);
  const bookingGaps = useMemo(() => generateBookingGaps(), []);
  const weeklyPayouts = useMemo(() => generateWeeklyPayouts(), []);

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenue = propertyFinancials.reduce((sum, p) => sum + p.grossRevenue, 0);
    const totalExpenses = propertyFinancials.reduce((sum, p) => sum + p.expenses, 0);
    const netProfit = totalRevenue - totalExpenses;
    const avgOccupancy = Math.round(propertyFinancials.reduce((sum, p) => sum + p.occupancyPercent, 0) / propertyFinancials.length);
    const avgRevPAR = Math.round(propertyFinancials.reduce((sum, p) => sum + p.revPAR, 0) / propertyFinancials.length);
    const profitMargin = ((netProfit / totalRevenue) * 100).toFixed(1);

    // YTD multiplier based on selection
    const multiplier = dateRange === 'mtd' ? 1 : dateRange === 'qtd' ? 3 : 12;

    return {
      totalRevenue: totalRevenue * multiplier,
      totalExpenses: totalExpenses * multiplier,
      netProfit: netProfit * multiplier,
      avgOccupancy,
      avgRevPAR,
      profitMargin,
    };
  }, [propertyFinancials, dateRange]);

  // Expense breakdown
  const expenseBreakdown = useMemo(
    () => generateExpenseBreakdown(totals.totalExpenses),
    [totals.totalExpenses]
  );

  // Sorted properties
  const sortedProperties = useMemo(() => {
    const sorted = [...propertyFinancials].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return showAllProperties ? sorted : sorted.slice(0, 10);
  }, [propertyFinancials, sortField, sortDirection, showAllProperties]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // Export handlers
  const handleExportCSV = () => {
    const headers = ['Property', 'Gross Revenue', 'Expenses', 'Net Profit', 'Occupancy %', 'Profit Margin %'];
    const rows = propertyFinancials.map(p => [
      p.propertyName,
      p.grossRevenue,
      p.expenses,
      p.netProfit,
      p.occupancyPercent,
      p.profitMarginPercent
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleExportPDF = () => {
    // In production, this would generate a PDF using a library like jsPDF
    alert('PDF export would generate a formatted Schedule E report');
  };

  const handleCreateSpecialOffer = (gap: BookingGap) => {
    // In production, this would create a special offer in the system
    alert(`Creating ${gap.suggestedDiscount}% discount for ${gap.propertyName} from ${gap.startDate} to ${gap.endDate}`);
    setSelectedGap(null);
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-4 h-4 opacity-30" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <DashboardShell>
      <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#2D2D2D] font-display flex items-center gap-3">
              <Eye className="w-8 h-8 text-[#500000]" />
              Financial God View
            </h1>
            <p className="text-[#2D2D2D]/60 mt-1">
              Complete portfolio financial management - {propertyFinancials.length} properties
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Selector */}
            <div className="flex bg-[#F5F5F0] rounded-xl p-1">
              {(['mtd', 'qtd', 'ytd'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    dateRange === range
                      ? 'bg-[#500000] text-white shadow-sm'
                      : 'text-[#2D2D2D]/70 hover:text-[#500000]'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="p-2.5 bg-white rounded-xl border border-[#2D2D2D]/10 hover:border-[#500000]/30 transition-colors"
              disabled={refreshing}
            >
              <RefreshCw className={`w-5 h-5 text-[#500000] ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Export Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors">
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-[#2D2D2D]/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F5F0] transition-colors rounded-t-xl"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Export CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F5F0] transition-colors rounded-b-xl"
                >
                  <FileText className="w-4 h-4 text-red-600" />
                  Export PDF (Schedule E)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 1: OVERVIEW CARDS */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Total Portfolio Revenue"
            value={totals.totalRevenue}
            prefix="$"
            subValue={dateRange === 'mtd' ? 'Month to Date' : dateRange === 'qtd' ? 'Quarter to Date' : 'Year to Date'}
            change="+12.5% vs last period"
            changeType="positive"
            icon={DollarSign}
          />
          <StatCard
            title="Total Expenses"
            value={totals.totalExpenses}
            prefix="$"
            subValue={`${((totals.totalExpenses / totals.totalRevenue) * 100).toFixed(1)}% of revenue`}
            change="+5.2% vs last period"
            changeType="negative"
            icon={TrendingDown}
          />
          <StatCard
            title="Net Profit"
            value={totals.netProfit}
            prefix="$"
            subValue={`${totals.profitMargin}% margin`}
            change="+15.8% vs last period"
            changeType="positive"
            icon={Wallet}
          />
          <StatCard
            title="Avg Occupancy"
            value={totals.avgOccupancy}
            suffix="%"
            subValue="Across all properties"
            change="+3.2% vs last period"
            changeType="positive"
            icon={BedDouble}
          />
          <StatCard
            title="RevPAR"
            value={totals.avgRevPAR}
            prefix="$"
            subValue="Revenue per available room"
            change="+8.5% vs last period"
            changeType="positive"
            icon={Target}
          />
        </div>

        {/* ============================================ */}
        {/* SECTION 2: PROPERTY FINANCIAL TABLE */}
        {/* ============================================ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5 shadow-sm mb-8"
        >
          <SectionHeader
            title="Property P&L Summary"
            subtitle="Click headers to sort"
            action={
              <button
                onClick={() => setShowAllProperties(!showAllProperties)}
                className="flex items-center gap-2 text-sm text-[#500000] hover:text-[#722F37] font-medium"
              >
                {showAllProperties ? 'Show Top 10' : `Show All ${propertyFinancials.length}`}
                <ChevronRight className="w-4 h-4" />
              </button>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2D2D2D]/10">
                  <th
                    className="text-left py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70 cursor-pointer hover:text-[#500000] transition-colors"
                    onClick={() => handleSort('propertyName')}
                  >
                    <div className="flex items-center gap-2">
                      Property <SortIcon field="propertyName" />
                    </div>
                  </th>
                  <th
                    className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70 cursor-pointer hover:text-[#500000] transition-colors"
                    onClick={() => handleSort('grossRevenue')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Gross Revenue <SortIcon field="grossRevenue" />
                    </div>
                  </th>
                  <th
                    className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70 cursor-pointer hover:text-[#500000] transition-colors"
                    onClick={() => handleSort('expenses')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Expenses <SortIcon field="expenses" />
                    </div>
                  </th>
                  <th
                    className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70 cursor-pointer hover:text-[#500000] transition-colors"
                    onClick={() => handleSort('netProfit')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Net Profit <SortIcon field="netProfit" />
                    </div>
                  </th>
                  <th
                    className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70 cursor-pointer hover:text-[#500000] transition-colors"
                    onClick={() => handleSort('occupancyPercent')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Occupancy <SortIcon field="occupancyPercent" />
                    </div>
                  </th>
                  <th
                    className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70 cursor-pointer hover:text-[#500000] transition-colors"
                    onClick={() => handleSort('profitMarginPercent')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Profit Margin <SortIcon field="profitMarginPercent" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProperties.map((property, index) => (
                  <motion.tr
                    key={property.propertyId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-[#2D2D2D]/5 hover:bg-[#F5F5F0]/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#500000]/10 to-[#722F37]/10 flex items-center justify-center">
                          <Home className="w-5 h-5 text-[#500000]" />
                        </div>
                        <span className="font-medium text-[#2D2D2D]">{property.propertyName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-emerald-600">
                      ${property.grossRevenue.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right text-red-600">
                      ${property.expenses.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-[#2D2D2D]">
                      ${property.netProfit.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                        property.occupancyPercent >= 80 ? 'bg-emerald-100 text-emerald-700' :
                        property.occupancyPercent >= 65 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {property.occupancyPercent}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                        property.profitMarginPercent >= 70 ? 'bg-emerald-100 text-emerald-700' :
                        property.profitMarginPercent >= 50 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {property.profitMarginPercent}%
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#500000]/5 font-bold">
                  <td className="py-4 px-4 text-[#2D2D2D]">Portfolio Total</td>
                  <td className="py-4 px-4 text-right text-emerald-600">
                    ${totals.totalRevenue.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-red-600">
                    ${totals.totalExpenses.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-[#2D2D2D]">
                    ${totals.netProfit.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-[#2D2D2D]">
                    {totals.avgOccupancy}%
                  </td>
                  <td className="py-4 px-4 text-right text-[#2D2D2D]">
                    {totals.profitMargin}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>

        {/* ============================================ */}
        {/* SECTION 3 & 4: CHARTS ROW */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Expense Breakdown Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5 shadow-sm"
          >
            <SectionHeader title="Expense Breakdown" subtitle="By tax category" />
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="category"
                    label={({ name, percentage }) => `${percentage}%`}
                    labelLine={false}
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #2D2D2D10',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Monthly Trend Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#2D2D2D]/5 shadow-sm"
          >
            <SectionHeader title="12-Month Financial Trend" subtitle="Revenue vs Expenses vs Net Profit" />
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D10" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#2D2D2D60" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#2D2D2D60"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #2D2D2D10',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="Net Profit"
                    stroke={CHART_COLORS.netProfit}
                    strokeWidth={3}
                    dot={{ fill: CHART_COLORS.netProfit, strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Monthly Stacked Expense Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5 shadow-sm mb-8"
        >
          <SectionHeader title="Monthly Expense Trend by Category" subtitle="Stacked view of expense categories" />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyData.map(m => ({
                  ...m,
                  cleaning: m.expenses * 0.32,
                  utilities: m.expenses * 0.18,
                  maintenance: m.expenses * 0.15,
                  supplies: m.expenses * 0.12,
                  insurance: m.expenses * 0.10,
                  other: m.expenses * 0.13,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D10" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#2D2D2D60" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#2D2D2D60"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #2D2D2D10',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="cleaning" name="Cleaning" stackId="a" fill={PIE_COLORS[0]} />
                <Bar dataKey="utilities" name="Utilities" stackId="a" fill={PIE_COLORS[1]} />
                <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill={PIE_COLORS[2]} />
                <Bar dataKey="supplies" name="Supplies" stackId="a" fill={PIE_COLORS[3]} />
                <Bar dataKey="insurance" name="Insurance" stackId="a" fill={PIE_COLORS[4]} />
                <Bar dataKey="other" name="Other" stackId="a" fill={PIE_COLORS[7]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ============================================ */}
        {/* SECTION 5 & 6: GAP FILLER & TAX EXPORT */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Gap-Filler Widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5 shadow-sm"
          >
            <SectionHeader
              title="Gap-Filler Opportunities"
              subtitle="Upcoming booking gaps (3+ days)"
              action={
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  {bookingGaps.length} gaps found
                </span>
              }
            />

            {bookingGaps.length === 0 ? (
              <div className="text-center py-12 text-[#2D2D2D]/50">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
                <p className="font-medium">No booking gaps found!</p>
                <p className="text-sm">All properties are well-booked.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {bookingGaps.map((gap) => (
                  <div
                    key={`${gap.propertyId}-${gap.startDate}`}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedGap === gap.propertyId
                        ? 'border-[#500000] bg-[#500000]/5'
                        : 'border-[#2D2D2D]/10 hover:border-[#500000]/30'
                    }`}
                    onClick={() => setSelectedGap(selectedGap === gap.propertyId ? null : gap.propertyId)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-[#2D2D2D]">{gap.propertyName}</h4>
                        <p className="text-sm text-[#2D2D2D]/60 mt-1">
                          <CalendarDays className="w-4 h-4 inline mr-1" />
                          {new Date(gap.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(gap.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                          {gap.gapDays} nights
                        </span>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedGap === gap.propertyId && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-[#2D2D2D]/10"
                        >
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-3 bg-[#F5F5F0] rounded-lg">
                              <p className="text-xs text-[#2D2D2D]/60">Suggested Discount</p>
                              <p className="text-xl font-bold text-[#500000]">{gap.suggestedDiscount}%</p>
                            </div>
                            <div className="p-3 bg-[#F5F5F0] rounded-lg">
                              <p className="text-xs text-[#2D2D2D]/60">Potential Revenue</p>
                              <p className="text-xl font-bold text-emerald-600">${Math.round(gap.potentialRevenue).toLocaleString()}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateSpecialOffer(gap);
                            }}
                            className="w-full py-2.5 bg-[#500000] text-white rounded-lg hover:bg-[#722F37] transition-colors font-medium flex items-center justify-center gap-2"
                          >
                            <Tag className="w-4 h-4" />
                            Create Special Offer
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Tax Export Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white"
          >
            <SectionHeader
              title="Tax Export - Schedule E"
              subtitle="IRS-ready categorized expenses"
            />

            <div className="space-y-3 mb-6">
              {expenseBreakdown.slice(0, 6).map((expense, index) => (
                <div key={expense.category} className="flex items-center justify-between py-2 border-b border-white/10">
                  <div>
                    <p className="font-medium">{expense.category}</p>
                    <p className="text-xs text-white/60">{expense.taxCategory}</p>
                  </div>
                  <p className="font-bold">${expense.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white/10 rounded-xl mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80">Date Range</span>
                <span className="font-semibold">
                  {dateRange === 'mtd' ? 'January 2026' : dateRange === 'qtd' ? 'Q1 2026' : 'FY 2025'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/80">Total Deductions</span>
                <span className="text-xl font-bold">${totals.totalExpenses.toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleExportCSV}
                className="py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-5 h-5" />
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="py-3 bg-[#C4A777] text-[#500000] hover:bg-[#D4B787] rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
              >
                <FileText className="w-5 h-5" />
                Export PDF
              </button>
            </div>
          </motion.div>
        </div>

        {/* ============================================ */}
        {/* SECTION 7: WEEKLY PAYOUT REPORT */}
        {/* ============================================ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5 shadow-sm"
        >
          <SectionHeader
            title="Weekly Payout Report"
            subtitle="Friday payout summary - Property breakdown"
            action={
              <div className="flex items-center gap-2 text-sm text-[#2D2D2D]/60">
                <Clock className="w-4 h-4" />
                Week of Jan 13-19, 2026
              </div>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2D2D2D]/10">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70">Property</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70">Gross Bookings</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70">Platform Fees</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70">Owner Payout</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-[#2D2D2D]/70">Cleaning Costs</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-emerald-600 font-bold">Net to Owner</th>
                </tr>
              </thead>
              <tbody>
                {weeklyPayouts.map((payout, index) => (
                  <tr key={payout.propertyId} className="border-b border-[#2D2D2D]/5 hover:bg-[#F5F5F0]/50 transition-colors">
                    <td className="py-4 px-4">
                      <span className="font-medium text-[#2D2D2D]">{payout.propertyName}</span>
                    </td>
                    <td className="py-4 px-4 text-right text-[#2D2D2D]">
                      ${payout.grossBookings.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right text-red-600">
                      -${payout.platformFees.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right text-[#2D2D2D]">
                      ${payout.ownerPayout.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right text-red-600">
                      -${payout.cleaningCosts.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-emerald-600">
                      ${payout.netToOwner.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#500000]/5 font-bold">
                  <td className="py-4 px-4 text-[#2D2D2D]">Weekly Total</td>
                  <td className="py-4 px-4 text-right text-[#2D2D2D]">
                    ${weeklyPayouts.reduce((sum, p) => sum + p.grossBookings, 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-red-600">
                    -${weeklyPayouts.reduce((sum, p) => sum + p.platformFees, 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-[#2D2D2D]">
                    ${weeklyPayouts.reduce((sum, p) => sum + p.ownerPayout, 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-red-600">
                    -${weeklyPayouts.reduce((sum, p) => sum + p.cleaningCosts, 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-emerald-600">
                    ${weeklyPayouts.reduce((sum, p) => sum + p.netToOwner, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Owner Distribution Summary */}
          <div className="mt-6 p-4 bg-gradient-to-r from-[#F5F5F0] to-transparent rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#500000] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#C4A777]" />
              </div>
              <div>
                <p className="text-sm text-[#2D2D2D]/60">Owner Distribution (Steven Palma)</p>
                <p className="text-2xl font-bold text-[#2D2D2D]">
                  ${weeklyPayouts.reduce((sum, p) => sum + p.netToOwner, 0).toLocaleString()}
                </p>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors font-medium">
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          </div>
        </motion.div>
      </div>
    </DashboardShell>
  );
}
