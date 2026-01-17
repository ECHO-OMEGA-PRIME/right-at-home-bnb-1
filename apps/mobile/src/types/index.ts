/**
 * Right at Home BnB - Type Definitions
 * Centralized types for the cleaner mobile app
 * @author ECHO OMEGA PRIME
 */

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  JobDetail: { jobId: string };
  Property: { propertyId: string };
  GPSCheckIn: {
    jobId: string;
    propertyId: string;
    propertyName: string;
    lat: number;
    lng: number;
    radius?: number;
  };
  PhotoCapture: {
    jobId: string;
    propertyId: string;
    taskType: string;
    requiredPhotos?: number;
  };
  Checklist: {
    jobId: string;
    propertyId: string;
    propertyName: string;
  };
  IssueReport: {
    jobId?: string;
    propertyId: string;
    propertyName: string;
  };
  Leaderboard: undefined;
  Messages: { conversationId?: string };
  Notifications: undefined;
  Settings: undefined;
};

// Job Types
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'urgent';

export interface PropertyLocation {
  latitude: number;
  longitude: number;
  address: string;
  radius: number; // meters for GPS check-in verification
}

export interface Job {
  id: string;
  propertyId: string;
  propertyName: string;
  address: string;
  scheduledDate: string;
  scheduledTime: string;
  expectedDuration: string;
  guestCheckIn: string;
  status: JobStatus;
  notes: string;
  location: PropertyLocation;
  basePayment: number;
  bonusMultiplier?: number;
  photos: Photo[];
  checklist: ChecklistItem[];
  checkInTime?: string;
  checkOutTime?: string;
  score?: number;
}

export interface JobSummary {
  id: string;
  propertyId: string;
  propertyName: string;
  address: string;
  scheduledDate: string;
  scheduledTime: string;
  status: JobStatus;
  photosCount: number;
  checklistProgress: {
    total: number;
    completed: number;
  };
  payment: number;
  bonusMultiplier?: number;
}

// Checklist Types
export type ChecklistArea =
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'livingRoom'
  | 'exterior'
  | 'laundry'
  | 'common'
  | 'finalWalkthrough';

export interface ChecklistItem {
  id: string;
  task: string;
  area: ChecklistArea;
  completed: boolean;
  photoRequired: boolean;
  photoUri?: string;
  notes?: string;
  completedAt?: string;
}

// Photo Types
export interface Photo {
  id: string;
  uri: string;
  timestamp: string;
  area?: ChecklistArea;
  taskId?: string;
  notes?: string;
  uploaded: boolean;
}

// User Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  role: 'cleaner' | 'supervisor' | 'admin';
  createdAt: string;
  lastLoginAt: string;
}

export interface CleanerProfile {
  userId: string;
  displayName: string;
  avatar?: string;
  initials: string;
  email: string;
  phone: string;
  role: string;
  memberSince: string;
  isTopPerformer: boolean;
}

export interface CleanerStats {
  totalJobs: number;
  avgScore: number;
  onTimeRate: number;
  todayJobs: number;
  todayCompleted: number;
  todayEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  totalEarnings: number;
  xp: number;
  level: number;
  rank: number;
  streak: number;
  achievementCount: number;
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatar?: string;
  score: number;
  jobsCompleted: number;
  earnings: number;
  isCurrentUser: boolean;
}

// Notification Types
export type NotificationType =
  | 'new_job'
  | 'urgent_job'
  | 'job_reminder'
  | 'job_completed'
  | 'payment_received'
  | 'achievement'
  | 'message'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  timestamp: string;
}

// Location Types
export interface LocationCheckResult {
  success: boolean;
  withinRange: boolean;
  distance?: number;
  timestamp: Date;
  errorMessage?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

// Settings Types
export interface AppSettings {
  notifications: {
    enabled: boolean;
    jobReminders: boolean;
    urgentJobs: boolean;
    messages: boolean;
    achievements: boolean;
  };
  privacy: {
    shareLocation: boolean;
    shareStats: boolean;
  };
  security: {
    biometricEnabled: boolean;
    requirePinOnOpen: boolean;
  };
  display: {
    darkMode: boolean;
    compactView: boolean;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

// Form Types
export interface IssueReport {
  id?: string;
  jobId?: string;
  propertyId: string;
  propertyName: string;
  category: 'maintenance' | 'supplies' | 'safety' | 'damage' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  photos: Photo[];
  status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt?: string;
}

// Supply Types
export interface SupplyItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  unit: string;
  needsRestock: boolean;
}

// Message Types
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}
