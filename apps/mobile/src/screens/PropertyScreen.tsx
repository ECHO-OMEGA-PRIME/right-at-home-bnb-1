import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

const COLORS = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  white: '#FFFFFF',
};

export default function PropertyScreen({ route }: any) {
  const propertyId = route?.params?.propertyId || 1;

  const property = {
    id: propertyId,
    name: 'Castleford Estate',
    address: '123 Oak Lane, Midland, TX 79705',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 8,
    amenities: ['WiFi', 'Smart TV', 'Kitchen', 'Washer/Dryer', 'Pool', 'Hot Tub'],
    wifi: { network: 'RightAtHome_Guest', password: 'Welcome2024' },
    checkout: '11:00 AM',
    supplies: [
      { item: 'Toilet Paper', location: 'Hall Closet', qty: 12 },
      { item: 'Paper Towels', location: 'Kitchen Cabinet', qty: 4 },
      { item: 'Bath Towels', location: 'Linen Closet', qty: 8 },
    ],
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.propertyName}>{property.name}</Text>
        <Text style={styles.address}>{property.address}</Text>
      </View>

      {/* Quick Info */}
      <View style={styles.quickInfo}>
        <View style={styles.infoItem}>
          <Text style={styles.infoValue}>{property.bedrooms}</Text>
          <Text style={styles.infoLabel}>Bedrooms</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoValue}>{property.bathrooms}</Text>
          <Text style={styles.infoLabel}>Bathrooms</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoValue}>{property.maxGuests}</Text>
          <Text style={styles.infoLabel}>Max Guests</Text>
        </View>
      </View>

      {/* WiFi */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📶 WiFi Information</Text>
        <View style={styles.card}>
          <View style={styles.wifiRow}>
            <Text style={styles.wifiLabel}>Network:</Text>
            <Text style={styles.wifiValue}>{property.wifi.network}</Text>
          </View>
          <View style={styles.wifiRow}>
            <Text style={styles.wifiLabel}>Password:</Text>
            <Text style={styles.wifiValue}>{property.wifi.password}</Text>
          </View>
        </View>
      </View>

      {/* Amenities */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✨ Amenities</Text>
        <View style={styles.amenitiesGrid}>
          {property.amenities.map((a, i) => (
            <View key={i} style={styles.amenityBadge}>
              <Text style={styles.amenityText}>{a}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Supplies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Supply Locations</Text>
        <View style={styles.card}>
          {property.supplies.map((s, i) => (
            <View key={i} style={styles.supplyRow}>
              <Text style={styles.supplyItem}>{s.item}</Text>
              <Text style={styles.supplyLocation}>{s.location}</Text>
              <Text style={styles.supplyQty}>Qty: {s.qty}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Checkout */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏰ Checkout Time</Text>
        <View style={styles.checkoutCard}>
          <Text style={styles.checkoutTime}>{property.checkout}</Text>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.maroon, padding: 20, paddingTop: 10 },
  propertyName: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
  address: { fontSize: 14, color: COLORS.white + 'CC', marginTop: 4 },
  quickInfo: { flexDirection: 'row', backgroundColor: COLORS.white, margin: 20, borderRadius: 16, padding: 20 },
  infoItem: { flex: 1, alignItems: 'center' },
  infoValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.maroon },
  infoLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.charcoal, marginBottom: 12 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16 },
  wifiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  wifiLabel: { fontSize: 14, color: '#666' },
  wifiValue: { fontSize: 14, fontWeight: '600', color: COLORS.charcoal },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityBadge: { backgroundColor: COLORS.maroon + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  amenityText: { fontSize: 13, color: COLORS.maroon, fontWeight: '500' },
  supplyRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  supplyItem: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.charcoal },
  supplyLocation: { flex: 1, fontSize: 14, color: '#666' },
  supplyQty: { fontSize: 14, color: COLORS.maroon, fontWeight: '500' },
  checkoutCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, alignItems: 'center' },
  checkoutTime: { fontSize: 36, fontWeight: 'bold', color: COLORS.maroon },
});
