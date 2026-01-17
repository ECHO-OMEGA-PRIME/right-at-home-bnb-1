/**
 * Right at Home BnB - Jobs Screen
 * All assigned jobs with filtering, date selection, and pull-to-refresh
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { JobSummary, JobStatus } from '../types';
import { StatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { NoJobs } from '../components/common/EmptyState';

type FilterType = 'all' | 'today' | 'upcoming' | 'completed' | 'urgent';

interface DateOption {
  label: string;
  value: string;
  count: number;
}

// Mock job data - would come from API
const generateMockJobs = (): JobSummary[] => [
  {
    id: '1',
    propertyId: 'prop_001',
    propertyName: 'Castleford Estate',
    address: '123 Oak Lane, Midland, TX 79705',
    scheduledTime: '2:00 PM',
    scheduledDate: new Date().toISOString(),
    status: 'in_progress',
    photosCount: 3,
    checklistProgress: { completed: 8, total: 12 },
    payment: 85,
  },
  {
    id: '2',
    propertyId: 'prop_002',
    propertyName: 'Basin View Cottage',
    address: '789 Basin Blvd, Midland, TX 79705',
    scheduledTime: '5:00 PM',
    scheduledDate: new Date().toISOString(),
    status: 'scheduled',
    photosCount: 0,
    checklistProgress: { completed: 0, total: 10 },
    payment: 65,
  },
  {
    id: '3',
    propertyId: 'prop_003',
    propertyName: 'Permian Palace',
    address: '456 Permian Way, Midland, TX 79705',
    scheduledTime: 'ASAP',
    scheduledDate: new Date().toISOString(),
    status: 'urgent',
    photosCount: 0,
    checklistProgress: { completed: 0, total: 10 },
    payment: 128,
    bonusMultiplier: 1.5,
  },
  {
    id: '4',
    propertyId: 'prop_004',
    propertyName: 'Petroleum Plaza Suite',
    address: '101 Main St, Midland, TX 79705',
    scheduledTime: '10:00 AM',
    scheduledDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    status: 'completed',
    photosCount: 12,
    checklistProgress: { completed: 10, total: 10 },
    payment: 75,
  },
  {
    id: '5',
    propertyId: 'prop_005',
    propertyName: 'Downtown Loft',
    address: '200 Center Ave, Midland, TX 79705',
    scheduledTime: '9:00 AM',
    scheduledDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    status: 'scheduled',
    photosCount: 0,
    checklistProgress: { completed: 0, total: 8 },
    payment: 60,
  },
  {
    id: '6',
    propertyId: 'prop_006',
    propertyName: 'Midland Manor',
    address: '350 Manor Dr, Midland, TX 79705',
    scheduledTime: '1:00 PM',
    scheduledDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    status: 'scheduled',
    photosCount: 0,
    checklistProgress: { completed: 0, total: 14 },
    payment: 95,
  },
];

// Job Card Component
const JobCard = ({
  job,
  onPress,
}: {
  job: JobSummary;
  onPress: () => void;
}) => {
  const isUrgent = job.status === 'urgent';
  const bonusActive = job.bonusMultiplier && job.bonusMultiplier > 1;
  const progressPercent =
    job.checklistProgress.total > 0
      ? Math.round(
          (job.checklistProgress.completed / job.checklistProgress.total) * 100
        )
      : 0;

  return (
    <TouchableOpacity
      style={[styles.jobCard, isUrgent && styles.jobCardUrgent]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isUrgent && (
        <View style={styles.urgentBanner}>
          <Text style={styles.urgentText}>URGENT - 1.5x PAY</Text>
        </View>
      )}

      <View style={styles.jobHeader}>
        <View style={styles.jobLeft}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(job.status) },
            ]}
          />
        </View>
        <View style={styles.jobContent}>
          <View style={styles.jobTitleRow}>
            <Text style={styles.jobProperty} numberOfLines={1}>
              {job.propertyName}
            </Text>
            {bonusActive && (
              <View style={styles.bonusTag}>
                <Text style={styles.bonusTagText}>{job.bonusMultiplier}x</Text>
              </View>
            )}
          </View>
          <Text style={styles.jobAddress} numberOfLines={1}>
            {job.address}
          </Text>

          {/* Meta Row */}
          <View style={styles.jobMeta}>
            <Text style={styles.metaItem}>* {job.scheduledTime}</Text>
            <Text style={styles.metaItem}>* {job.photosCount}</Text>
            <Text style={styles.metaItem}>
              * {job.checklistProgress.completed}/{job.checklistProgress.total}
            </Text>
          </View>

          {/* Progress Bar for in-progress jobs */}
          {job.status === 'in_progress' && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${progressPercent}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{progressPercent}%</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.jobFooter}>
        <StatusBadge status={job.status} />
        <Text style={styles.jobPayment}>${job.payment.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Filter Tab Component
const FilterTab = ({
  label,
  count,
  isActive,
  onPress,
  isUrgent,
}: {
  label: string;
  count?: number;
  isActive: boolean;
  onPress: () => void;
  isUrgent?: boolean;
}) => (
  <TouchableOpacity
    style={[
      styles.filterTab,
      isActive && styles.filterTabActive,
      isUrgent && isActive && styles.filterTabUrgent,
    ]}
    onPress={onPress}
  >
    <Text
      style={[
        styles.filterText,
        isActive && styles.filterTextActive,
        isUrgent && isActive && styles.filterTextUrgent,
      ]}
    >
      {label}
    </Text>
    {count !== undefined && count > 0 && (
      <View
        style={[
          styles.filterBadge,
          isActive && styles.filterBadgeActive,
          isUrgent && styles.filterBadgeUrgent,
        ]}
      >
        <Text
          style={[
            styles.filterBadgeText,
            isActive && styles.filterBadgeTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

// Date Selector Component
const DateSelector = ({
  options,
  selectedDate,
  onSelect,
}: {
  options: DateOption[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.dateSelector}
  >
    {options.map((option) => (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.dateOption,
          selectedDate === option.value && styles.dateOptionActive,
        ]}
        onPress={() => onSelect(option.value)}
      >
        <Text
          style={[
            styles.dateOptionText,
            selectedDate === option.value && styles.dateOptionTextActive,
          ]}
        >
          {option.label}
        </Text>
        {option.count > 0 && (
          <Text
            style={[
              styles.dateOptionCount,
              selectedDate === option.value && styles.dateOptionCountActive,
            ]}
          >
            {option.count}
          </Text>
        )}
      </TouchableOpacity>
    ))}
  </ScrollView>
);

function getStatusColor(status: JobStatus): string {
  switch (status) {
    case 'completed':
      return COLORS.success;
    case 'in_progress':
      return COLORS.warning;
    case 'urgent':
      return COLORS.error;
    case 'cancelled':
      return COLORS.gray;
    default:
      return COLORS.grayLight;
  }
}

function getDateLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function JobsScreen({ navigation }: any) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[]>(generateMockJobs());
  const [showDateModal, setShowDateModal] = useState(false);

  // Generate date options from jobs
  const dateOptions: DateOption[] = useMemo(() => {
    const dates = new Map<string, number>();
    jobs.forEach((job) => {
      const dateKey = new Date(job.scheduledDate).toDateString();
      dates.set(dateKey, (dates.get(dateKey) || 0) + 1);
    });

    const options: DateOption[] = [
      { label: 'All Dates', value: 'all', count: jobs.length },
    ];

    const sortedDates = Array.from(dates.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );

    sortedDates.forEach(([dateStr, count]) => {
      const date = new Date(dateStr);
      options.push({
        label: getDateLabel(date),
        value: dateStr,
        count,
      });
    });

    return options;
  }, [jobs]);

  // Filter counts
  const filterCounts = useMemo(() => {
    return {
      all: jobs.length,
      today: jobs.filter(
        (j) =>
          new Date(j.scheduledDate).toDateString() === new Date().toDateString()
      ).length,
      upcoming: jobs.filter(
        (j) =>
          j.status === 'scheduled' &&
          new Date(j.scheduledDate) > new Date()
      ).length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      urgent: jobs.filter((j) => j.status === 'urgent').length,
    };
  }, [jobs]);

  // Apply filters
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Status filter
    switch (filter) {
      case 'today':
        result = result.filter(
          (j) =>
            new Date(j.scheduledDate).toDateString() ===
            new Date().toDateString()
        );
        break;
      case 'upcoming':
        result = result.filter(
          (j) =>
            j.status === 'scheduled' &&
            new Date(j.scheduledDate) >= new Date()
        );
        break;
      case 'completed':
        result = result.filter((j) => j.status === 'completed');
        break;
      case 'urgent':
        result = result.filter((j) => j.status === 'urgent');
        break;
    }

    // Date filter
    if (selectedDate !== 'all') {
      result = result.filter(
        (j) => new Date(j.scheduledDate).toDateString() === selectedDate
      );
    }

    // Sort: urgent first, then by scheduled time
    result.sort((a, b) => {
      if (a.status === 'urgent' && b.status !== 'urgent') return -1;
      if (b.status === 'urgent' && a.status !== 'urgent') return 1;
      return (
        new Date(a.scheduledDate).getTime() -
        new Date(b.scheduledDate).getTime()
      );
    });

    return result;
  }, [jobs, filter, selectedDate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // In real app, fetch fresh data from API
    setJobs(generateMockJobs());
    setRefreshing(false);
  }, []);

  const renderJob = ({ item }: { item: JobSummary }) => (
    <JobCard
      job={item}
      onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
    />
  );

  if (loading) {
    return <LoadingSpinner message="Loading jobs..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
        <TouchableOpacity
          style={styles.calendarButton}
          onPress={() => setShowDateModal(true)}
        >
          <Text style={styles.calendarIcon}>*</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          <FilterTab
            label="All"
            count={filterCounts.all}
            isActive={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterTab
            label="Today"
            count={filterCounts.today}
            isActive={filter === 'today'}
            onPress={() => setFilter('today')}
          />
          <FilterTab
            label="Upcoming"
            count={filterCounts.upcoming}
            isActive={filter === 'upcoming'}
            onPress={() => setFilter('upcoming')}
          />
          <FilterTab
            label="Completed"
            count={filterCounts.completed}
            isActive={filter === 'completed'}
            onPress={() => setFilter('completed')}
          />
          {filterCounts.urgent > 0 && (
            <FilterTab
              label="Urgent"
              count={filterCounts.urgent}
              isActive={filter === 'urgent'}
              onPress={() => setFilter('urgent')}
              isUrgent
            />
          )}
        </ScrollView>
      </View>

      {/* Date Selector */}
      <DateSelector
        options={dateOptions}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
        </Text>
        {selectedDate !== 'all' && (
          <TouchableOpacity onPress={() => setSelectedDate('all')}>
            <Text style={styles.clearFilter}>Clear date filter</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Job List */}
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.maroon}
            colors={[COLORS.maroon]}
          />
        }
        ListEmptyComponent={
          <NoJobs
            onRefresh={onRefresh}
            style={styles.emptyState}
          />
        }
      />

      {/* Date Picker Modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <Text style={styles.modalClose}>*</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {dateOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOption,
                    selectedDate === option.value && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedDate(option.value);
                    setShowDateModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedDate === option.value &&
                        styles.modalOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.modalOptionCount,
                      selectedDate === option.value &&
                        styles.modalOptionCountActive,
                    ]}
                  >
                    {option.count} job{option.count !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.maroon,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIcon: {
    fontSize: 20,
    color: COLORS.white,
  },

  // Filter Tabs
  filterContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.grayLighter,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: COLORS.maroon,
  },
  filterTabUrgent: {
    backgroundColor: COLORS.error,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  filterTextUrgent: {
    color: COLORS.white,
  },
  filterBadge: {
    backgroundColor: COLORS.grayLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeUrgent: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  filterBadgeTextActive: {
    color: COLORS.white,
  },

  // Date Selector
  dateSelector: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: COLORS.white,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
    gap: 6,
  },
  dateOptionActive: {
    backgroundColor: COLORS.gold + '30',
    borderColor: COLORS.gold,
  },
  dateOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  dateOptionTextActive: {
    color: COLORS.maroon,
    fontWeight: '600',
  },
  dateOptionCount: {
    fontSize: 11,
    color: COLORS.gray,
  },
  dateOptionCountActive: {
    color: COLORS.maroon,
  },

  // Results Header
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resultsCount: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '500',
  },
  clearFilter: {
    fontSize: 13,
    color: COLORS.maroon,
    fontWeight: '600',
  },

  // List Content
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyState: {
    marginTop: 40,
  },

  // Job Card
  jobCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobCardUrgent: {
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  urgentBanner: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  urgentText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  jobHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  jobLeft: {
    marginRight: 12,
    paddingTop: 4,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  jobContent: {
    flex: 1,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  jobProperty: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  bonusTag: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  bonusTagText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  jobAddress: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  jobMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    fontSize: 12,
    color: COLORS.grayLight,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
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
    minWidth: 36,
    textAlign: 'right',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLighter,
  },
  jobPayment: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  modalClose: {
    fontSize: 24,
    color: COLORS.gray,
  },
  modalScroll: {
    padding: 16,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: COLORS.cream,
  },
  modalOptionActive: {
    backgroundColor: COLORS.maroon + '15',
    borderWidth: 1,
    borderColor: COLORS.maroon,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  modalOptionTextActive: {
    color: COLORS.maroon,
    fontWeight: '600',
  },
  modalOptionCount: {
    fontSize: 13,
    color: COLORS.gray,
  },
  modalOptionCountActive: {
    color: COLORS.maroon,
  },
});
