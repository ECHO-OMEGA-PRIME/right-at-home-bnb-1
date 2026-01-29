/**
 * Right at Home BnB - Demo Mode Configuration
 * Provides minimal example data for demonstration purposes
 * NO FINANCIAL DATA - Only UI examples
 * 
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Midland, TX
 */

// Demo Mode State - Set to false for production
export const DEMO_MODE = false;

// Contact Information (Real - for click-to-call)
export const CONTACT_INFO = {
  phone: '+14325591904',
  phoneDisplay: '(432) 559-1904',
  email: 'steven.palma@RAH-midland.com',
  name: 'Steven Palma',
  company: 'Right at Home BnB',
  address: 'Midland, TX 79701',
};

// Demo Activity Items - Only 2 examples, clearly marked
export const DEMO_ACTIVITIES = [
  {
    id: 'demo_1',
    type: 'check_in' as const,
    title: 'Example Check-in',
    description: 'This is a demo activity item',
    timestamp: new Date(),
    property: 'Demo Property',
    status: 'info' as const,
    isDemo: true,
  },
  {
    id: 'demo_2',
    type: 'cleaning' as const,
    title: 'Example Cleaning',
    description: 'Demo cleaning completion notification',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    property: 'Demo Property',
    status: 'success' as const,
    isDemo: true,
  },
];

// Demo Schedule Items - Only show structure, no fake data
export const DEMO_SCHEDULE = {
  checkIns: [] as any[],  // Empty in production
  checkOuts: [] as any[],
  cleanings: [] as any[],
};

// Demo Stats - Show zeros or placeholders
export const DEMO_STATS = {
  todayCheckIns: 0,
  todayCheckOuts: 0,
  activeCleanings: 0,
  occupancyRate: 0,
  monthlyRevenue: 0, // NEVER show fake financial data
  pendingMessages: 0,
};

// Empty chart data templates
export const EMPTY_CHART_DATA = {
  revenue: [],
  occupancy: [],
  propertyBreakdown: [],
};

// Feature flags for demo elements
export const DEMO_FEATURES = {
  showExampleActivities: false,  // Disabled by default
  showExampleSchedule: false,
  showExampleCharts: false,
  showClickToCallDemo: true,  // Always show this works
};

// Helper to check if we're in demo mode
export const isDemoMode = () => DEMO_MODE;

// Helper to get appropriate data based on mode
export const getDemoOrReal = <T>(demoData: T, realData: T | undefined | null): T | null => {
  if (DEMO_MODE && !realData) {
    return demoData;
  }
  return realData ?? null;
};

// Click-to-call helper
export const initiateCall = () => {
  window.location.href = `tel:${CONTACT_INFO.phone}`;
};

// Click-to-email helper
export const initiateEmail = (subject?: string) => {
  const subjectParam = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  window.location.href = `mailto:${CONTACT_INFO.email}${subjectParam}`;
};
