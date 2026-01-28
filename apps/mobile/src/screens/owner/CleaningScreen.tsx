/**
 * Cleaning Screen
 * Manage cleaning tasks and schedules for all properties
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, isToday, isTomorrow, isPast, addDays, differenceInHours } from 'date-fns';
import { COLORS } from '../../theme/colors';

type TaskStatus = 'all' | 'pending' | 'in_progress' | 'completed';
type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

interface CleaningTask {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyImage?: string;
  type: 'turnover' | 'deep_clean' | 'maintenance' | 'inspection';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'issue_reported';
  priority: TaskPriority;
  scheduledDate: Date;
  scheduledTime?: string;
  estimatedDuration: number; // minutes
  assignedTo?: {
    id: string;
    name: string;
    avatar?: string;
    phone?: string;
  };
  checklist?: {
    id: string;
    task: string;
    completed: boolean;
  }[];
  notes?: string;
  guestCheckIn?: Date;
  completedAt?: Date;
  photos?: string[];
}

// Mock data
const generateMockTasks = (): CleaningTask[] => [
  {
    id: '1',
    propertyId: '1',
    propertyName: 'Castleford Estate',
    propertyImage: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=200',
    type: 'turnover',
    status: 'pending',
    priority: 'urgent',
    scheduledDate: new Date(),
    scheduledTime: '10:00 AM',
    estimatedDuration: 180,
    guestCheckIn: addDays(new Date(), 0),
    checklist: [
      { id: '1', task: 'Strip beds and start laundry', completed: false },
      { id: '2', task: 'Clean all bathrooms', completed: false },
      { id: '3', task: 'Vacuum and mop floors', completed: false },
      { id: '4', task: 'Wipe kitchen surfaces', completed: false },
      { id: '5', task: 'Restock supplies', completed: false },
      { id: '6', task: 'Make beds with fresh linens', completed: false },
    ],
  },
  {
    id: '2',
    propertyId: '2',
    propertyName: 'Basin View Cottage',
    propertyImage: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=200',
    type: 'turnover',
    status: 'in_progress',
    priority: 'high',
    scheduledDate: new Date(),
    scheduledTime: '2:00 PM',
    estimatedDuration: 120,
    guestCheckIn: addDays(new Date(), 1),
    assignedTo: {
      id: 'c1',
      name: 'Maria Garcia',
      avatar: 'https://i.pravatar.cc/100?img=5',
      phone: '+1 (432) 555-0123',
    },
    checklist: [
      { id: '1', task: 'Strip beds and start laundry', completed: true },
      { id: '2', task: 'Clean all bathrooms', completed: true },
      { id: '3', task: 'Vacuum and mop floors', completed: false },
      { id: '4', task: 'Wipe kitchen surfaces', completed: false },
    ],
  },
  {
    id: '3',
    propertyId: '4',
    propertyName: 'Downtown Loft',
    type: 'deep_clean',
    status: 'assigned',
    priority: 'normal',
    scheduledDate: addDays(new Date(), 2),
    scheduledTime: '9:00 AM',
    estimatedDuration: 240,
    assignedTo: {
      id: 'c2',
      name: 'James Wilson',
      avatar: 'https://i.pravatar.cc/100?img=12',
      phone: '+1 (432) 555-0456',
    },
    notes: 'Quarterly deep clean - pay extra attention to carpets',
  },
  {
    id: '4',
    propertyId: '6',
    propertyName: 'Executive Suite',
    type: 'maintenance',
    status: 'pending',
    priority: 'high',
    scheduledDate: addDays(new Date(), 1),
    scheduledTime: '11:00 AM',
    estimatedDuration: 60,
    notes: 'Replace air filter, check smoke detectors',
  },
  {
    id: '5',
    propertyId: '3',
    propertyName: 'Permian Palace',
    type: 'inspection',
    status: 'completed',
    priority: 'normal',
    scheduledDate: addDays(new Date(), -1),
    estimatedDuration: 45,
    completedAt: addDays(new Date(), -1),
    assignedTo: {
      id: 'c1',
      name: 'Maria Garcia',
      avatar: 'https://i.pravatar.cc/100?img=5',
    },
    photos: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400',
    ],
  },
  {
    id: '6',
    propertyId: '1',
    propertyName: 'Castleford Estate',
    type: 'turnover',
    status: 'issue_reported',
    priority: 'urgent',
    scheduledDate: addDays(new Date(), -2),
    estimatedDuration: 180,
    assignedTo: {
      id: 'c2',
      name: 'James Wilson',
      avatar: 'https://i.pravatar.cc/100?img=12',
    },
    notes: 'Guest left significant mess - may need additional supplies',
  },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'pending', label: 'Pending', icon: '⏳' },
  { key: 'in_progress', label: 'In Progress', icon: '🧹' },
  { key: 'completed', label: 'Done', icon: '✓' },
];

const TYPE_CONFIG = {
  turnover: { label: 'Turnover', icon: '🔄', color: COLORS.maroon },
  deep_clean: { label: 'Deep Clean', icon: '✨', color: '#6366F1' },
  maintenance: { label: 'Maintenance', icon: '🔧', color: '#F59E0B' },
  inspection: { label: 'Inspection', icon: '🔍', color: '#10B981' },
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
  assigned: { label: 'Assigned', color: '#3B82F6', bg: '#DBEAFE' },
  in_progress: { label: 'In Progress', color: '#8B5CF6', bg: '#EDE9FE' },
  completed: { label: 'Completed', color: '#10B981', bg: '#D1FAE5' },
  issue_reported: { label: 'Issue', color: '#EF4444', bg: '#FEE2E2' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#EF4444' },
  high: { label: 'High', color: '#F59E0B' },
  normal: { label: 'Normal', color: '#3B82F6' },
  low: { label: 'Low', color: '#6B7280' },
};

export default function CleaningScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('all');

  const allTasks = generateMockTasks();

  const filteredTasks = useMemo(() => {
    return allTasks
      .filter((task) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'pending') return task.status === 'pending' || task.status === 'assigned';
        if (statusFilter === 'in_progress') return task.status === 'in_progress' || task.status === 'issue_reported';
        if (statusFilter === 'completed') return task.status === 'completed';
        return true;
      })
      .sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        // Then by date
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      });
  }, [allTasks, statusFilter]);

  const stats = useMemo(() => {
    const today = new Date();
    return {
      todayTasks: allTasks.filter((t) => isToday(new Date(t.scheduledDate)) && t.status !== 'completed').length,
      pending: allTasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length,
      inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
      issues: allTasks.filter((t) => t.status === 'issue_reported').length,
    };
  }, [allTasks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return format(date, 'MMM d') + ' (Past)';
    return format(date, 'EEE, MMM d');
  };

  const getUrgencyIndicator = (task: CleaningTask) => {
    if (task.status === 'completed') return null;
    if (task.guestCheckIn) {
      const hoursUntilCheckIn = differenceInHours(new Date(task.guestCheckIn), new Date());
      if (hoursUntilCheckIn <= 4) {
        return { label: 'Check-in soon!', color: '#EF4444' };
      }
      if (hoursUntilCheckIn <= 24) {
        return { label: `${Math.ceil(hoursUntilCheckIn)}h to check-in`, color: '#F59E0B' };
      }
    }
    return null;
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Stats Overview */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <Text style={styles.statValuePrimary}>{stats.todayTasks}</Text>
          <Text style={styles.statLabelPrimary}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        {stats.issues > 0 && (
          <View style={[styles.statCard, styles.statCardIssue]}>
            <Text style={[styles.statValue, styles.statValueIssue]}>{stats.issues}</Text>
            <Text style={[styles.statLabel, styles.statLabelIssue]}>Issues</Text>
          </View>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {STATUS_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              statusFilter === filter.key && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter(filter.key as TaskStatus)}
          >
            <Text style={styles.filterIcon}>{filter.icon}</Text>
            <Text
              style={[
                styles.filterLabel,
                statusFilter === filter.key && styles.filterLabelActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTask = ({ item }: { item: CleaningTask }) => {
    const typeConfig = TYPE_CONFIG[item.type];
    const statusConfig = STATUS_CONFIG[item.status];
    const priorityConfig = PRIORITY_CONFIG[item.priority];
    const urgency = getUrgencyIndicator(item);

    const checklistProgress = item.checklist
      ? item.checklist.filter((c) => c.completed).length / item.checklist.length
      : null;

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => navigation.navigate('CleaningDetail', { taskId: item.id })}
        activeOpacity={0.7}
      >
        {/* Urgency Banner */}
        {urgency && (
          <View style={[styles.urgencyBanner, { backgroundColor: urgency.color }]}>
            <Text style={styles.urgencyText}>{urgency.label}</Text>
          </View>
        )}

        <View style={styles.taskContent}>
          {/* Left: Property Image */}
          {item.propertyImage ? (
            <Image source={{ uri: item.propertyImage }} style={styles.propertyImage} />
          ) : (
            <View style={[styles.propertyImage, styles.propertyImagePlaceholder]}>
              <Text style={styles.propertyImageIcon}>🏠</Text>
            </View>
          )}

          {/* Middle: Task Info */}
          <View style={styles.taskInfo}>
            <View style={styles.taskHeader}>
              <Text style={[styles.typeLabel, { color: typeConfig.color }]}>
                {typeConfig.icon} {typeConfig.label}
              </Text>
              {item.priority === 'urgent' && (
                <View style={styles.priorityBadge}>
                  <Text style={[styles.priorityText, { color: priorityConfig.color }]}>
                    {priorityConfig.label}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.propertyName} numberOfLines={1}>
              {item.propertyName}
            </Text>

            <View style={styles.taskMeta}>
              <Text style={styles.scheduleText}>
                {getDateLabel(new Date(item.scheduledDate))}
                {item.scheduledTime && ` at ${item.scheduledTime}`}
              </Text>
              <Text style={styles.durationText}>
                ~{Math.floor(item.estimatedDuration / 60)}h {item.estimatedDuration % 60}m
              </Text>
            </View>

            {/* Checklist Progress */}
            {checklistProgress !== null && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${checklistProgress * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(checklistProgress * 100)}%
                </Text>
              </View>
            )}

            {/* Assigned To */}
            {item.assignedTo && (
              <View style={styles.assignedTo}>
                {item.assignedTo.avatar ? (
                  <Image
                    source={{ uri: item.assignedTo.avatar }}
                    style={styles.assigneeAvatar}
                  />
                ) : (
                  <View style={[styles.assigneeAvatar, styles.assigneeAvatarPlaceholder]}>
                    <Text style={styles.assigneeInitial}>
                      {item.assignedTo.name.charAt(0)}
                    </Text>
                  </View>
                )}
                <Text style={styles.assigneeName}>{item.assignedTo.name}</Text>
              </View>
            )}
          </View>

          {/* Right: Status */}
          <View style={styles.taskStatus}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.bg },
              ]}
            >
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🧹</Text>
      <Text style={styles.emptyTitle}>No Tasks</Text>
      <Text style={styles.emptySubtitle}>
        {statusFilter === 'pending'
          ? 'No pending cleaning tasks'
          : statusFilter === 'in_progress'
          ? 'No tasks in progress'
          : statusFilter === 'completed'
          ? 'No completed tasks'
          : 'No cleaning tasks scheduled'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.maroon}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB - Add Task */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddCleaningTask')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 16,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statCardPrimary: {
    backgroundColor: COLORS.maroon,
  },
  statCardIssue: {
    backgroundColor: '#FEE2E2',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  statValuePrimary: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
  },
  statValueIssue: {
    color: '#EF4444',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
  statLabelPrimary: {
    fontSize: 11,
    color: COLORS.white + '80',
    marginTop: 2,
  },
  statLabelIssue: {
    color: '#EF4444',
  },

  // Filters
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },
  filterIcon: {
    fontSize: 14,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  filterLabelActive: {
    color: COLORS.white,
  },

  // List
  list: {
    paddingBottom: 100,
  },

  // Task Card
  taskCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  urgencyBanner: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  taskContent: {
    flexDirection: 'row',
    padding: 12,
  },
  propertyImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  propertyImagePlaceholder: {
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyImageIcon: {
    fontSize: 24,
  },
  taskInfo: {
    flex: 1,
    marginLeft: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  propertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  durationText: {
    fontSize: 12,
    color: COLORS.grayLight,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.maroon,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.maroon,
    width: 35,
  },
  assignedTo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  assigneeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  assigneeAvatarPlaceholder: {
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeInitial: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
  },
  assigneeName: {
    fontSize: 12,
    color: COLORS.gray,
  },
  taskStatus: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 28,
    color: COLORS.white,
    lineHeight: 30,
  },
});
