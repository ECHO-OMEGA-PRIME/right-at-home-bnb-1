/**
 * Right at Home BnB - Next Job Card Component
 * Prominent card for the upcoming job with ETA
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';
import { JobSummary } from '../../types';
import { Button } from '../common/Button';

interface NextJobCardProps {
  job: JobSummary;
  etaMinutes?: number;
  distanceMiles?: number;
  onPress: () => void;
  onNavigate?: () => void;
  onCheckIn?: () => void;
  style?: ViewStyle;
}

export function NextJobCard({
  job,
  etaMinutes,
  distanceMiles,
  onPress,
  onNavigate,
  onCheckIn,
  style,
}: NextJobCardProps) {
  const [countdown, setCountdown] = useState<string>('');
  const isUrgent = job.status === 'urgent';

  useEffect(() => {
    // Calculate countdown to scheduled time
    const updateCountdown = () => {
      const now = new Date();
      const [time, period] = job.scheduledTime.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      const scheduled = new Date();
      scheduled.setHours(
        period === 'PM' && hours !== 12 ? hours + 12 : hours === 12 && period === 'AM' ? 0 : hours
      );
      scheduled.setMinutes(minutes || 0);
      scheduled.setSeconds(0);

      const diff = scheduled.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('Now');
      } else {
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hrs > 0) {
          setCountdown(`${hrs}h ${mins}m`);
        } else {
          setCountdown(`${mins}m`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [job.scheduledTime]);

  return (
    <TouchableOpacity
      style={[styles.card, isUrgent && styles.cardUrgent, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>NEXT JOB</Text>
          {isUrgent && (
            <View style={styles.urgentTag}>
              <Text style={styles.urgentText}>URGENT</Text>
            </View>
          )}
        </View>
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>Starts in</Text>
          <Text style={styles.countdownValue}>{countdown}</Text>
        </View>
      </View>

      <Text style={styles.propertyName}>{job.propertyName}</Text>
      <Text style={styles.address}>{job.address}</Text>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>*</Text>
          <Text style={styles.infoText}>{job.scheduledTime}</Text>
        </View>
        {etaMinutes !== undefined && (
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>*</Text>
            <Text style={styles.infoText}>{etaMinutes} min away</Text>
          </View>
        )}
        {distanceMiles !== undefined && (
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>*</Text>
            <Text style={styles.infoText}>{distanceMiles.toFixed(1)} mi</Text>
          </View>
        )}
      </View>

      <View style={styles.paymentRow}>
        <Text style={styles.paymentLabel}>Payment:</Text>
        <Text style={styles.paymentValue}>
          ${job.payment.toFixed(2)}
          {job.bonusMultiplier && job.bonusMultiplier > 1 && (
            <Text style={styles.bonusText}> ({job.bonusMultiplier}x)</Text>
          )}
        </Text>
      </View>

      <View style={styles.actions}>
        {onNavigate && (
          <Button
            title="Navigate"
            icon="*"
            onPress={onNavigate}
            variant="outline"
            size="small"
            style={styles.actionButton}
          />
        )}
        {onCheckIn && (
          <Button
            title="Check In"
            icon="*"
            onPress={onCheckIn}
            variant="primary"
            size="small"
            style={styles.actionButton}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

interface UrgentAlertCardProps {
  job: JobSummary;
  onPress: () => void;
  style?: ViewStyle;
}

export function UrgentAlertCard({ job, onPress, style }: UrgentAlertCardProps) {
  return (
    <TouchableOpacity
      style={[styles.alertCard, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.alertIcon}>*</Text>
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>Urgent Job Available!</Text>
        <Text style={styles.alertSub}>
          {job.propertyName} - 1.5x pay (${job.payment})
        </Text>
      </View>
      <Text style={styles.alertArrow}>*</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.maroon,
    borderRadius: 20,
    padding: 20,
    shadowColor: COLORS.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardUrgent: {
    backgroundColor: COLORS.error,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  urgentTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  countdownBox: {
    alignItems: 'flex-end',
  },
  countdownLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  countdownValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  propertyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoIcon: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  paymentLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  paymentValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  bonusText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gold,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderColor: COLORS.white,
  },

  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  alertIcon: {
    fontSize: 24,
    color: COLORS.white,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  alertSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  alertArrow: {
    fontSize: 20,
    color: COLORS.white,
    fontWeight: 'bold',
  },
});
