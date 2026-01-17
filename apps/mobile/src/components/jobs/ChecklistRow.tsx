/**
 * Right at Home BnB - Checklist Row Component
 * Individual task item with photo support
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';
import { ChecklistItem, ChecklistArea } from '../../types';

interface ChecklistRowProps {
  item: ChecklistItem;
  onToggle: () => void;
  onTakePhoto?: () => void;
  onViewPhoto?: () => void;
  style?: ViewStyle;
}

export function ChecklistRow({
  item,
  onToggle,
  onTakePhoto,
  onViewPhoto,
  style,
}: ChecklistRowProps) {
  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity style={styles.content} onPress={onToggle}>
        <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
          {item.completed && <Text style={styles.checkmark}>*</Text>}
        </View>
        <View style={styles.taskInfo}>
          <Text style={[styles.taskText, item.completed && styles.taskCompleted]}>
            {item.task}
          </Text>
          <Text style={styles.areaLabel}>{formatArea(item.area)}</Text>
        </View>
      </TouchableOpacity>

      {item.photoRequired && (
        <TouchableOpacity
          style={[
            styles.photoButton,
            item.photoUri ? styles.photoButtonCompleted : null,
          ]}
          onPress={item.photoUri ? onViewPhoto : onTakePhoto}
        >
          {item.photoUri ? (
            <Image source={{ uri: item.photoUri }} style={styles.photoThumbnail} />
          ) : (
            <Text style={styles.photoIcon}>*</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

interface ChecklistSectionProps {
  title: string;
  area: ChecklistArea;
  items: ChecklistItem[];
  onToggleItem: (id: string) => void;
  onTakePhoto: (id: string) => void;
  onViewPhoto: (id: string) => void;
  style?: ViewStyle;
}

export function ChecklistSection({
  title,
  area,
  items,
  onToggleItem,
  onTakePhoto,
  onViewPhoto,
  style,
}: ChecklistSectionProps) {
  const sectionItems = items.filter((item) => item.area === area);
  const completedCount = sectionItems.filter((item) => item.completed).length;

  if (sectionItems.length === 0) return null;

  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{getAreaIcon(area)}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>
          {completedCount}/{sectionItems.length}
        </Text>
      </View>
      <View style={styles.sectionContent}>
        {sectionItems.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            onToggle={() => onToggleItem(item.id)}
            onTakePhoto={() => onTakePhoto(item.id)}
            onViewPhoto={() => onViewPhoto(item.id)}
          />
        ))}
      </View>
    </View>
  );
}

function formatArea(area: ChecklistArea): string {
  const labels: Record<ChecklistArea, string> = {
    bedroom: 'Bedroom',
    bathroom: 'Bathroom',
    kitchen: 'Kitchen',
    livingRoom: 'Living Room',
    exterior: 'Exterior',
    laundry: 'Laundry',
    common: 'Common Areas',
    finalWalkthrough: 'Final Walkthrough',
  };
  return labels[area] || area;
}

function getAreaIcon(area: ChecklistArea): string {
  const icons: Record<ChecklistArea, string> = {
    bedroom: '*',
    bathroom: '*',
    kitchen: '*',
    livingRoom: '*',
    exterior: '*',
    laundry: '*',
    common: '*',
    finalWalkthrough: '*',
  };
  return icons[area] || '*';
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },
  checkmark: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  taskInfo: {
    flex: 1,
  },
  taskText: {
    fontSize: 14,
    color: COLORS.charcoal,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.gray,
  },
  areaLabel: {
    fontSize: 10,
    color: COLORS.grayLight,
    marginTop: 2,
  },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    overflow: 'hidden',
  },
  photoButtonCompleted: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  photoIcon: {
    fontSize: 18,
    color: COLORS.gray,
  },
  photoThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },

  // Section styles
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 8,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.maroon,
  },
  sectionContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
});
