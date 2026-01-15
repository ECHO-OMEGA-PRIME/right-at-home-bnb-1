import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList
} from 'react-native';

const COLORS = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  white: '#FFFFFF',
};

interface Job {
  id: number;
  property: string;
  address: string;
  scheduledTime: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  photos: number;
  checklist: { total: number; completed: number };
}

const mockJobs: Job[] = [
  { id: 1, property: 'Castleford Estate', address: '123 Oak Lane', scheduledTime: '2:00 PM', status: 'in_progress', photos: 3, checklist: { total: 12, completed: 8 } },
  { id: 2, property: 'Basin View Cottage', address: '789 Basin Blvd', scheduledTime: '5:00 PM', status: 'scheduled', photos: 0, checklist: { total: 10, completed: 0 } },
  { id: 3, property: 'Petroleum Plaza Suite', address: '456 Main St', scheduledTime: '10:00 AM', status: 'completed', photos: 8, checklist: { total: 10, completed: 10 } },
  { id: 4, property: 'Downtown Loft', address: '101 Center Ave', scheduledTime: '3:00 PM', status: 'scheduled', photos: 0, checklist: { total: 8, completed: 0 } },
];

const JobCard = ({ job, onPress }: { job: Job; onPress: () => void }) => (
  <TouchableOpacity style={styles.jobCard} onPress={onPress}>
    <View style={styles.jobLeft}>
      <View style={[
        styles.statusIndicator,
        { backgroundColor: job.status === 'completed' ? '#4CAF50' : job.status === 'in_progress' ? '#FFA500' : '#999' }
      ]} />
    </View>
    <View style={styles.jobContent}>
      <Text style={styles.jobProperty}>{job.property}</Text>
      <Text style={styles.jobAddress}>{job.address}</Text>
      <View style={styles.jobMeta}>
        <Text style={styles.jobTime}>🕐 {job.scheduledTime}</Text>
        <Text style={styles.jobPhotos}>📷 {job.photos}</Text>
        <Text style={styles.jobChecklist}>
          ✓ {job.checklist.completed}/{job.checklist.total}
        </Text>
      </View>
    </View>
    <View style={styles.jobRight}>
      <View style={[
        styles.statusBadge,
        { backgroundColor: job.status === 'completed' ? '#E8F5E9' : job.status === 'in_progress' ? '#FFF3E0' : '#F5F5F5' }
      ]}>
        <Text style={[
          styles.statusText,
          { color: job.status === 'completed' ? '#2E7D32' : job.status === 'in_progress' ? '#E65100' : '#666' }
        ]}>
          {job.status.replace('_', ' ').toUpperCase()}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

export default function JobsScreen({ navigation }: any) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredJobs = mockJobs.filter(job => {
    if (filter === 'all') return true;
    if (filter === 'active') return job.status !== 'completed';
    if (filter === 'completed') return job.status === 'completed';
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['all', 'active', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Job List */}
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <JobCard
            job={item}
            onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  filterTabActive: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  jobCard: {
    flexDirection: 'row',
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
  jobProperty: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  jobAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  jobMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  jobTime: {
    fontSize: 12,
    color: '#666',
  },
  jobPhotos: {
    fontSize: 12,
    color: '#666',
  },
  jobChecklist: {
    fontSize: 12,
    color: '#666',
  },
  jobRight: {
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
