/**
 * Properties Screen
 * List of all properties with filtering and search
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { PropertyCard } from '../../components/owner/PropertyCard';

type PropertyStatus = 'all' | 'active' | 'inactive' | 'maintenance';
type ViewMode = 'list' | 'grid';

// Mock data
const MOCK_PROPERTIES = [
  {
    id: '1',
    name: 'Castleford Estate',
    address: '789 Mansion Dr, Midland, TX',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
    status: 'active' as const,
    currentBooking: { guestName: 'John Smith', checkOut: new Date('2024-01-20') },
    stats: { occupancyRate: 85, rating: 4.9, monthlyRevenue: 5200 },
  },
  {
    id: '2',
    name: 'Basin View Cottage',
    address: '456 Lake Rd, Midland, TX',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
    status: 'active' as const,
    nextBooking: { guestName: 'Sarah Johnson', checkIn: new Date('2024-01-18') },
    stats: { occupancyRate: 72, rating: 4.7, monthlyRevenue: 3800 },
  },
  {
    id: '3',
    name: 'Permian Palace',
    address: '123 Oil Baron Ln, Midland, TX',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400',
    status: 'maintenance' as const,
    stats: { occupancyRate: 65, rating: 4.6, monthlyRevenue: 3200 },
  },
  {
    id: '4',
    name: 'Downtown Loft',
    address: '201 Main St #5A, Midland, TX',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400',
    status: 'active' as const,
    stats: { occupancyRate: 88, rating: 4.8, monthlyRevenue: 4100 },
  },
  {
    id: '5',
    name: 'Ranch House',
    address: '1500 Country Rd, Midland, TX',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400',
    status: 'inactive' as const,
    stats: { occupancyRate: 0, rating: 4.5, monthlyRevenue: 0 },
  },
  {
    id: '6',
    name: 'Executive Suite',
    address: '300 Business Park, Midland, TX',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400',
    status: 'active' as const,
    currentBooking: { guestName: 'Mike Chen', checkOut: new Date('2024-01-25') },
    stats: { occupancyRate: 92, rating: 4.9, monthlyRevenue: 6800 },
  },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'All', icon: '🏠' },
  { key: 'active', label: 'Active', icon: '✅' },
  { key: 'inactive', label: 'Inactive', icon: '⏸️' },
  { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
];

export default function PropertiesScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const filteredProperties = useMemo(() => {
    return MOCK_PROPERTIES.filter((property) => {
      const matchesSearch =
        searchQuery === '' ||
        property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        property.address.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || property.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: MOCK_PROPERTIES.length,
      active: MOCK_PROPERTIES.filter((p) => p.status === 'active').length,
      inactive: MOCK_PROPERTIES.filter((p) => p.status === 'inactive').length,
      maintenance: MOCK_PROPERTIES.filter((p) => p.status === 'maintenance').length,
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search properties..."
          placeholderTextColor={COLORS.grayLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filters */}
      <View style={styles.filters}>
        {STATUS_FILTERS.map((filter) => {
          const count =
            filter.key === 'all'
              ? stats.total
              : stats[filter.key as keyof typeof stats];

          return (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                statusFilter === filter.key && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(filter.key as PropertyStatus)}
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
              <View
                style={[
                  styles.filterCount,
                  statusFilter === filter.key && styles.filterCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    statusFilter === filter.key && styles.filterCountTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'list' && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode('list')}
        >
          <Text style={styles.toggleIcon}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === 'grid' && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode('grid')}
        >
          <Text style={styles.toggleIcon}>▦</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProperty = ({ item, index }: { item: typeof MOCK_PROPERTIES[0]; index: number }) => (
    <View style={viewMode === 'grid' ? styles.gridItem : undefined}>
      <PropertyCard
        {...item}
        variant={viewMode}
        onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })}
      />
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🏠</Text>
      <Text style={styles.emptyTitle}>No Properties Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Add your first property to get started'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddProperty')}
        >
          <Text style={styles.addButtonText}>+ Add Property</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredProperties}
        renderItem={renderProperty}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // Force re-render on view mode change
        contentContainerStyle={[
          styles.list,
          viewMode === 'grid' && styles.gridList,
        ]}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.maroon}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddProperty')}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.charcoal,
  },
  clearIcon: {
    fontSize: 18,
    color: COLORS.grayLight,
    padding: 4,
  },

  // Filters
  filters: {
    flexDirection: 'row',
    marginBottom: 16,
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
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  filterLabelActive: {
    color: COLORS.white,
  },
  filterCount: {
    backgroundColor: COLORS.grayLighter,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterCountActive: {
    backgroundColor: COLORS.white + '30',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  filterCountTextActive: {
    color: COLORS.white,
  },

  // View Toggle
  viewToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.maroon,
  },
  toggleIcon: {
    fontSize: 18,
    color: COLORS.charcoal,
  },

  // List
  list: {
    paddingBottom: 100,
  },
  gridList: {
    paddingHorizontal: 16,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridItem: {
    width: '48%',
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
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
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
