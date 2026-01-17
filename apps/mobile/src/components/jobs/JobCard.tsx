/**
 * Right at Home BnB - Job Card Component
 * Display job summary in a card format
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';
import { JobSummary, JobStatus } from '../../types';
import { StatusBadge } from '../common/Badge';

interface JobCardProps {
  job: JobSummary;
  onPress: () => void;
  style?: ViewStyle;
}

export function JobCard({ job, onPress, style }: JobCardProps) {
  const isUrgent = job.status === 'urgent';
  const bonusActive = job.bonusMultiplier && job.bonusMultiplier > 1;

  return (
    <TouchableOpacity
      style={[styles.card, isUrgent && styles.cardUrgent, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isUrgent && (
        <View style={styles.urgentBanner}>
          <Text style={styles.urgentText}>URGENT - 1.5x PAY</Text>
        </View>
      )}

      <View style={styles.header}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(job.status) },
          ]}
        />
        <Text style={styles.propertyName} numberOfLines={1}>
          {job.propertyName}
        </Text>
        {bonusActive && (
          <View style={styles.bonusTag}>
            <Text style={styles.bonusTagText}>{job.bonusMultiplier}x</Text>
          </View>
        )}
      </View>

      <Text style={styles.address} numberOfLines={1}>
        {job.address}
      </Text>

      <View style={styles.meta}>
        <Text style={styles.time}>* {job.scheduledTime}</Text>
        <Text style={styles.photos}>* {job.photosCount}</Text>
        <Text style={styles.checklist}>
          * {job.checklistProgress.completed}/{job.checklistProgress.total}
        </Text>
      </View>

      <View style={styles.footer}>
        <StatusBadge status={job.status} />
        <Text style={styles.payment}>${job.payment.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface JobCardCompactProps {
  job: JobSummary;
  onPress: () => void;
  style?: ViewStyle;
}

export function JobCardCompact({ job, onPress, style }: JobCardCompactProps) {
  return (
    <TouchableOpacity
      style={[styles.compactCard, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.compactLeft}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(job.status) },
          ]}
        />
      </View>
      <View style={styles.compactContent}>
        <Text style={styles.compactProperty} numberOfLines={1}>
          {job.propertyName}
        </Text>
        <Text style={styles.compactTime}>{job.scheduledTime}</Text>
      </View>
      <View style={styles.compactRight}>
        <Text style={styles.compactPayment}>${job.payment}</Text>
        <Text style={styles.compactArrow}>*</Text>
      </View>
    </TouchableOpacity>
  );
}

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUrgent: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  propertyName: {
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
  address: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
    marginLeft: 18,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    marginLeft: 18,
  },
  time: {
    fontSize: 12,
    color: COLORS.gray,
  },
  photos: {
    fontSize: 12,
    color: COLORS.gray,
  },
  checklist: {
    fontSize: 12,
    color: COLORS.gray,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payment: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },

  // Compact styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  compactLeft: {
    justifyContent: 'center',
  },
  compactContent: {
    flex: 1,
  },
  compactProperty: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  compactTime: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactPayment: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  compactArrow: {
    fontSize: 16,
    color: COLORS.grayLight,
  },
});
