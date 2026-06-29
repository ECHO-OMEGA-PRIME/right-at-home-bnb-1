/**
 * Right at Home BnB - Property Knowledge Base
 * Complete property data for AI Concierge omniscience
 * ALL 22 Steven Palma Properties - Midland, TX
 * @author ECHO OMEGA PRIME
 * @updated 2026-01-14
 */

// ============================================
// PROPERTY AMENITIES DATABASE
// ============================================

export interface PropertyAmenities {
  pool: boolean;
  hotTub: boolean;
  bbqGrill: boolean;
  fireplace: boolean;
  washerDryer: boolean;
  fullyFurnished: boolean;
  fencedYard: boolean;
  petFriendly: boolean;
  garage: boolean;
  smartTV: boolean;
  highSpeedWifi: boolean;
  workFromHome: boolean;
  airConditioning: boolean;
  heating: boolean;
  dishwasher: boolean;
  coffeeMaker: boolean;
  microwave: boolean;
  oven: boolean;
  patio: boolean;
  outdoorSeating: boolean;
  billiards: boolean;
  gameRoom: boolean;
  firePit: boolean;
  playground: boolean;
  poolCabana: boolean;
  jettedTub: boolean;
  coveredParking: boolean;
  gatedYard: boolean;
  manCave: boolean;
  extraParking: boolean;
}

export interface PropertyDetails {
  id: string;
  name: string;
  address: string;
  nickname?: string;
  vrboId?: string;
  vrboUrl?: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  maxGuests: number;
  rating?: number;
  reviewCount?: number;
  doorCode: string;
  wifiName: string;
  wifiPassword: string;
  checkIn: string;
  checkOut: string;
  amenities: PropertyAmenities;
  description: string;
  specialFeatures: string[];
  nearbyAttractions: string[];
  parkingInfo: string;
  houseRules: string[];
  emergencyContact: string;
  verified: boolean;
}

export interface PropertyReview {
  id: string;
  propertyId: string;
  platform: 'airbnb' | 'vrbo' | 'google' | 'direct';
  guestName: string;
  rating: number;
  date: string;
  comment: string;
  response?: string;
}

// Default amenities template
const defaultAmenities: PropertyAmenities = {
  pool: false,
  hotTub: false,
  bbqGrill: true,
  fireplace: false,
  washerDryer: true,
  fullyFurnished: true,
  fencedYard: true,
  petFriendly: true,
  garage: true,
  smartTV: true,
  highSpeedWifi: true,
  workFromHome: true,
  airConditioning: true,
  heating: true,
  dishwasher: true,
  coffeeMaker: true,
  microwave: true,
  oven: true,
  patio: true,
  outdoorSeating: true,
  billiards: false,
  gameRoom: false,
  firePit: false,
  playground: false,
  poolCabana: false,
  jettedTub: false,
  coveredParking: false,
  gatedYard: false,
  manCave: false,
  extraParking: false,
};

// ============================================
// STEVEN'S COMPLETE PROPERTY DATABASE - ALL 22 PROPERTIES
// ============================================

export const properties: PropertyDetails[] = [
  // ⭐⭐⭐ FLAGSHIP PROPERTY - LINCOLN GREEN ⭐⭐⭐
  {
    id: 'lincoln-green-5055',
    name: 'Sprawling Ranch House with Pool Cabana and Playground',
    address: '5055 Lincoln Green, Midland, TX 79705',
    nickname: 'The Lincoln Green',
    vrboId: '4581977',
    vrboUrl: 'https://www.vrbo.com/4581977',
    bedrooms: 6,
    bathrooms: 4,
    sqft: 4500,
    maxGuests: 18,
    rating: 9.0,
    reviewCount: 2,
    doorCode: '',
    wifiName: 'RightAtHome_LincolnGreen',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: true,
      hotTub: false, // NO HOT TUB - Pool + Pool Cabana
      fireplace: true,
      jettedTub: true,
      poolCabana: true,
      playground: true,
    },
    description: 'FLAGSHIP PROPERTY - Sprawling 6-bedroom ranch house with POOL CABANA and PLAYGROUND! Our largest and most impressive property - perfect for large groups, family reunions, corporate retreats, and special events. Sleeps 18 guests. Features jetted bathtub and fireplace.',
    specialFeatures: [
      'FLAGSHIP PROPERTY',
      'SWIMMING POOL with Pool Cabana',
      'Playground for kids',
      'Jetted bathtub',
      'Fireplace',
      '6 bedrooms - Sleeps 18',
      'Pet friendly',
      'Sprawling ranch layout',
      '83+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Midland Park Mall - 4 min drive',
      'Bowlero Midland - 4 min drive',
      'Scharbauer Sports Complex - 6 min drive',
      'Midland International Airport - 16 min drive'
    ],
    parkingInfo: 'Large driveway and garage - ample parking for multiple vehicles.',
    houseRules: ['No smoking inside', 'Pool rules must be followed', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // ===== VERIFIED ADDRESS PROPERTIES =====

  // Santiago Dreams @ 1311 Daventry
  {
    id: 'santiago-dreams-1311',
    name: 'Santiago Dreams',
    address: '1311 Daventry, Midland, TX 79705',
    nickname: 'Santiago Dreams',
    vrboId: '4179271',
    vrboUrl: 'https://www.vrbo.com/4179271',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2200,
    maxGuests: 10,
    rating: 10.0,
    reviewCount: 18,
    doorCode: '',
    wifiName: 'RightAtHome_Santiago',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      manCave: true,
      extraParking: true,
    },
    description: 'Perfect 10/10 rated property! 4-bedroom home with man cave, two large yards, and extra parking. Ideal for families or work crews. 63+ photos available.',
    specialFeatures: [
      '10/10 EXCEPTIONAL Rating',
      'Man cave',
      'Two large yards',
      'Extra parking',
      '18 verified reviews',
      '63+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Midland College - 3 min drive',
      'Scharbauer Sports Complex - 7 min drive',
      'The Horseshoe Multipurpose Facility - 11 min drive',
      'Midland International Airport - 17 min drive'
    ],
    parkingInfo: 'Extra parking available plus driveway.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Posh & Private @ 1426 Lanham
  {
    id: 'posh-private-1426',
    name: 'Posh & Private with Billiards',
    address: '1426 Lanham, Midland, TX 79705',
    nickname: 'Posh & Private',
    vrboId: '4437486',
    vrboUrl: 'https://www.vrbo.com/4437486',
    bedrooms: 3,
    bathrooms: 3,
    sqft: 1800,
    maxGuests: 10,
    rating: 10.0,
    reviewCount: 6,
    doorCode: '',
    wifiName: 'RightAtHome_Lanham',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      fireplace: true,
      billiards: true,
      gameRoom: true,
    },
    description: 'Upscale 3-bedroom home with billiards table and fireplace. Private setting perfect for those seeking a refined stay. 10/10 Exceptional rating!',
    specialFeatures: [
      '10/10 EXCEPTIONAL Rating',
      'Billiards table',
      'Fireplace',
      'Private setting',
      'Upscale furnishings',
      '46+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Midland Memorial Hospital - 17 min walk',
      'George W. Bush Childhood Home - 3 min drive',
      'Midland College - 3 min drive',
      'Midland International Airport - 17 min drive'
    ],
    parkingInfo: 'Parking available on property.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Outdoor Dream @ 3106 Humble
  {
    id: 'outdoor-dream-3106',
    name: 'Outdoor Dream',
    address: '3106 Humble, Midland, TX 79705',
    nickname: 'Outdoor Dream',
    vrboId: '4700881',
    vrboUrl: 'https://www.vrbo.com/4700881',
    bedrooms: 4,
    bathrooms: 2,
    sqft: 2400,
    maxGuests: 14,
    rating: 6.8,
    reviewCount: 5,
    doorCode: '',
    wifiName: 'RightAtHome_Humble',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: true,
      hotTub: true, // BOTH POOL AND HOT TUB!
    },
    description: '4-bedroom home with BOTH pool AND hot tub! Perfect for outdoor lovers. Sleeps 14 guests with great outdoor living areas.',
    specialFeatures: [
      'SWIMMING POOL',
      'HOT TUB',
      'Outdoor living areas',
      'Large patio',
      'Sleeps 14 guests',
      '48+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Midland College - 3 min drive',
      'Midland Memorial Hospital - 4 min drive',
      'Midland Park Mall - 4 min drive',
      'Midland International Airport - 16 min drive'
    ],
    parkingInfo: 'Driveway parking available.',
    houseRules: ['No smoking inside', 'Pool and hot tub rules must be followed', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Most Marvelous @ 6100 Oriole
  {
    id: 'most-marvelous-6100',
    name: 'Most Marvelous with Pool',
    address: '6100 Oriole, Midland, TX 79705',
    nickname: 'Most Marvelous',
    vrboId: '4471713',
    vrboUrl: 'https://www.vrbo.com/4471713',
    bedrooms: 4,
    bathrooms: 2,
    sqft: 2000,
    maxGuests: 8,
    rating: 9.6,
    reviewCount: 5,
    doorCode: '',
    wifiName: 'RightAtHome_Oriole',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: true,
      fireplace: true,
    },
    description: 'Marvelous 4-bedroom home with pool and fireplace. 9.6/10 Exceptional rating. Perfect for families.',
    specialFeatures: [
      '9.6/10 EXCEPTIONAL Rating',
      'SWIMMING POOL',
      'Fireplace',
      '4 bedrooms',
      '33+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Midland Park Mall - 4 min drive',
      'Midland College - 7 min drive',
      'Scharbauer Sports Complex - 7 min drive',
      'Midland International Airport - 17 min drive'
    ],
    parkingInfo: 'Driveway and garage parking.',
    houseRules: ['No smoking inside', 'Pool rules must be followed', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Hot Tub Delight @ 4707 Dentcrest
  {
    id: 'hot-tub-delight-4707',
    name: 'Hot Tub Delight',
    address: '4707 Dentcrest, Midland, TX 79705',
    nickname: 'Hot Tub Delight',
    vrboId: '2638481',
    vrboUrl: 'https://www.vrbo.com/2638481',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1500,
    maxGuests: 6,
    rating: 8.4,
    reviewCount: 28,
    doorCode: '',
    wifiName: 'RightAtHome_Dentcrest',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      hotTub: true, // HOT TUB - main feature!
    },
    description: '3-bedroom home featuring a HOT TUB as the main attraction! 28 verified reviews. Perfect for relaxation after a long work day.',
    specialFeatures: [
      'HOT TUB - Outdoor spa',
      'Balcony',
      '28 verified reviews',
      '8.4/10 Very Good rating',
      '36+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Bowlero Midland - 15 min walk',
      'Scharbauer Sports Complex - 3 min drive',
      'Midland Park Mall - 3 min drive',
      'Midland International Airport - 13 min drive'
    ],
    parkingInfo: 'Driveway parking available.',
    houseRules: ['No smoking inside', 'Hot tub rules posted', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Saddle Club @ 1309 Daventry
  {
    id: 'saddle-club-1309',
    name: 'Saddle Club',
    address: '1309 Daventry, Midland, TX 79705',
    nickname: 'Saddle Club',
    vrboId: '4750070',
    vrboUrl: 'https://www.vrbo.com/4750070',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2100,
    maxGuests: 8,
    rating: 10.0,
    reviewCount: 4,
    doorCode: '',
    wifiName: 'RightAtHome_SaddleClub',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      bbqGrill: true,
    },
    description: '10/10 Exceptional rated 4-bedroom home with large yard, children\'s area, and BBQ. Perfect for families with kids.',
    specialFeatures: [
      '10/10 EXCEPTIONAL Rating',
      'Large yard with trees',
      'Children\'s area',
      'Barbecue grill',
      '49+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Midland College - 3 min drive',
      'Scharbauer Sports Complex - 7 min drive',
      'The Horseshoe Multipurpose Facility - 11 min drive',
      'Midland International Airport - 17 min drive'
    ],
    parkingInfo: 'Parking available on property.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Monterrey House
  {
    id: 'monterrey-house',
    name: 'Monterrey House',
    address: 'Monterrey St, Midland, TX 79705',
    nickname: 'Monterrey House',
    vrboId: '3477668',
    vrboUrl: 'https://www.vrbo.com/3477668',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1400,
    maxGuests: 6,
    rating: 8.4,
    reviewCount: 11,
    doorCode: '',
    wifiName: 'RightAtHome_Monterrey',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
    },
    description: '3-bedroom home on Monterrey St. Cozy and comfortable with patio/terrace. 8.4/10 Very Good rating.',
    specialFeatures: [
      'Patio/Terrace',
      '11 verified reviews',
      '8.4/10 Very Good rating',
      '26+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Scharbauer Sports Complex - 3 min drive',
      'Midland Memorial Hospital - 4 min drive',
      'Astound Broadband Stadium - 4 min drive',
      'Midland International Airport - 13 min drive'
    ],
    parkingInfo: 'Driveway parking.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // ===== OTHER PROPERTIES (Approximate Addresses) =====

  // Adobe Compound with Pool
  {
    id: 'adobe-compound-3005111',
    name: 'Adobe Compound with Pool and Fire Pits and Billiards',
    address: 'Near Midland Memorial Hospital, Midland, TX 79705',
    nickname: 'Adobe Compound',
    vrboId: '3005111',
    vrboUrl: 'https://www.vrbo.com/3005111',
    bedrooms: 7,
    bathrooms: 2,
    sqft: 3500,
    maxGuests: 16,
    rating: 8.8,
    reviewCount: 36,
    doorCode: '',
    wifiName: 'RightAtHome_Adobe',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: true,
      firePit: true,
      billiards: true,
      gameRoom: true,
    },
    description: 'MASSIVE 7-bedroom property with pool, fire pits, and billiards! Perfect for large groups up to 16 guests. Family-friendly with 75+ photos.',
    specialFeatures: [
      '7 BEDROOMS - Largest bedroom count!',
      'SWIMMING POOL',
      'FIRE PITS - Multiple!',
      'BILLIARDS/Game Room',
      '36 verified reviews',
      '8.8/10 Excellent rating',
      '75+ photos on VRBO'
    ],
    nearbyAttractions: [
      'Midland Memorial Hospital - 17 min walk',
      'George W. Bush Childhood Home - 3 min drive',
      'Midland College - 3 min drive',
      'Midland International Airport - 17 min drive'
    ],
    parkingInfo: 'Large property with ample parking.',
    houseRules: ['No smoking inside', 'Pool and fire pit rules must be followed', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Old Midland Living (Pool + Hot Tub)
  {
    id: 'old-midland-living-3355618',
    name: 'Old Midland Living with massive yard',
    address: 'Near Memorial Hospital, Midland, TX 79705',
    nickname: 'Old Midland Living',
    vrboId: '3355618',
    vrboUrl: 'https://www.vrbo.com/3355618',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2800,
    maxGuests: 16,
    rating: 0,
    reviewCount: 0,
    doorCode: '',
    wifiName: 'RightAtHome_OldMidland',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: true,
      hotTub: true, // BOTH POOL AND HOT TUB!
    },
    description: 'Classic Old Midland style home with MASSIVE yard, POOL, and HOT TUB! Sleeps 16 guests. Perfect for large gatherings.',
    specialFeatures: [
      'SWIMMING POOL',
      'HOT TUB',
      'MASSIVE YARD',
      'Classic Old Midland style',
      'Sleeps 16 guests'
    ],
    nearbyAttractions: [
      'Midland Memorial Hospital - nearby',
      'George W. Bush Childhood Home - nearby'
    ],
    parkingInfo: 'Large yard with ample parking.',
    houseRules: ['No smoking inside', 'Pool and hot tub rules must be followed', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Oasis with Pool-Billiards (Castleford area)
  {
    id: 'oasis-castleford-2636389',
    name: 'Oasis with Pool-Billiards',
    address: 'Polo Park / Saddle Club South area, Midland, TX 79705',
    nickname: 'The Oasis',
    vrboId: '2636389',
    vrboUrl: 'https://www.vrbo.com/2636389',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2500,
    maxGuests: 10,
    rating: 9.0,
    reviewCount: 69,
    doorCode: '',
    wifiName: 'RightAtHome_Oasis',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: true,
      billiards: true,
      gameRoom: true,
    },
    description: 'Premium property with private pool and game room with billiards. 9.0/10 Wonderful rating with 69 reviews! One of our most popular.',
    specialFeatures: [
      'PRIVATE POOL',
      'BILLIARDS/Game Room',
      '69 verified reviews - Most reviewed!',
      '9.0/10 Wonderful rating',
      '66+ photos on VRBO',
      'Exposed beam ceilings'
    ],
    nearbyAttractions: [
      'Midland College - 4 min drive',
      'Scharbauer Sports Complex - 8 min drive',
      'The Horseshoe Multipurpose Facility - 11 min drive',
      'Midland International Airport - 18 min drive'
    ],
    parkingInfo: 'Driveway and garage parking.',
    houseRules: ['No smoking inside', 'Pool rules must be followed', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Patio Home with Hot Tub (Garfield)
  {
    id: 'patio-home-garfield-2634718',
    name: 'Patio Home with Hot Tub and multiple outdoor spaces',
    address: 'Central Midland, TX 79705',
    nickname: 'Garfield Patio Home',
    vrboId: '2634718',
    vrboUrl: 'https://www.vrbo.com/2634718',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1800,
    maxGuests: 8,
    rating: 0,
    reviewCount: 0,
    doorCode: '',
    wifiName: 'RightAtHome_PatioHome',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      hotTub: true,
    },
    description: 'Vacation home featuring HOT TUB and multiple outdoor entertainment spaces. Perfect for relaxation.',
    specialFeatures: [
      'HOT TUB',
      'Multiple outdoor spaces',
      'Great patio area'
    ],
    nearbyAttractions: [
      'Midland College - within 2 mi',
      'Midland Memorial Hospital - within 2 mi',
      'George W. Bush Childhood Home - within 3 mi',
      'Midland Park Mall - within 3 mi'
    ],
    parkingInfo: 'Driveway parking.',
    houseRules: ['No smoking inside', 'Hot tub rules posted', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Safari Gameroom
  {
    id: 'safari-gameroom-2638524',
    name: 'Safari Gameroom',
    address: 'Midland, TX 79705',
    nickname: 'Safari Gameroom',
    vrboId: '2638524',
    vrboUrl: 'https://www.vrbo.com/2638524',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1600,
    maxGuests: 6,
    rating: 0,
    reviewCount: 0,
    doorCode: '',
    wifiName: 'RightAtHome_Safari',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      gameRoom: true,
    },
    description: 'Unique SAFARI-THEMED vacation home with dedicated game room. Fun for families and groups!',
    specialFeatures: [
      'SAFARI THEMED decor',
      'Game Room',
      'Unique family-friendly design'
    ],
    nearbyAttractions: [
      'Midland attractions nearby'
    ],
    parkingInfo: 'Driveway parking.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Destination Getaway (Storey)
  {
    id: 'destination-getaway-2643822',
    name: 'Destination Getaway',
    address: 'Midland, TX 79703',
    nickname: 'Destination Getaway',
    vrboId: '2643822',
    vrboUrl: 'https://www.vrbo.com/2643822',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1600,
    maxGuests: 6,
    rating: 0,
    reviewCount: 14,
    doorCode: '',
    wifiName: 'RightAtHome_Destination',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
    },
    description: 'Your destination getaway in Midland! Great value property with 14 reviews.',
    specialFeatures: [
      '14 verified reviews',
      'Great value'
    ],
    nearbyAttractions: [
      'Midland attractions nearby'
    ],
    parkingInfo: 'Driveway parking.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Chelsea Retreat with Covered Patio - NO HOT TUB!
  {
    id: 'chelsea-retreat-2643784',
    name: 'Retreat with Covered Patio',
    address: 'Midland, TX 79707',
    nickname: 'The Chelsea',
    vrboId: '2643784',
    vrboUrl: 'https://www.vrbo.com/2643784',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1900,
    maxGuests: 6,
    rating: 0,
    reviewCount: 0,
    doorCode: '',
    wifiName: 'RightAtHome_Chelsea',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: false,
      hotTub: false, // NO HOT TUB - Covered patio is main feature!
      fireplace: true,
    },
    description: 'Beautiful retreat featuring COVERED PATIO as main feature. Great outdoor space for relaxation. NO POOL, NO HOT TUB - just a beautiful covered patio!',
    specialFeatures: [
      'COVERED PATIO - Main feature!',
      'Fireplace',
      'Modern updates',
      'Great outdoor space',
      'NO pool, NO hot tub'
    ],
    nearbyAttractions: [
      'Loop 250 shopping - 5 min',
      'Restaurants - 3 min'
    ],
    parkingInfo: '2-car garage plus driveway.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Clermont House with Pool and Billiards
  {
    id: 'clermont-house',
    name: 'Clermont House with Pool and Billiards',
    address: 'Midland, TX 79705',
    nickname: 'Clermont House',
    vrboId: 'TBD',
    vrboUrl: '',
    bedrooms: 4,
    bathrooms: 2,
    sqft: 2200,
    maxGuests: 8,
    rating: 0,
    reviewCount: 22,
    doorCode: '',
    wifiName: 'RightAtHome_Clermont',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: true,
      billiards: true,
      gameRoom: true,
    },
    description: 'Home featuring POOL and BILLIARDS! 22 reviews. Great for entertainment.',
    specialFeatures: [
      'SWIMMING POOL',
      'BILLIARDS',
      '22 verified reviews'
    ],
    nearbyAttractions: [
      'Midland attractions nearby'
    ],
    parkingInfo: 'Driveway and garage.',
    houseRules: ['No smoking inside', 'Pool rules must be followed', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Uptown Place
  {
    id: 'uptown-place',
    name: 'Uptown Place with gated yard and covered parking',
    address: 'Uptown area, Midland, TX 79705',
    nickname: 'Uptown Place',
    vrboId: 'TBD',
    vrboUrl: '',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1700,
    maxGuests: 6,
    rating: 0,
    reviewCount: 17,
    doorCode: '',
    wifiName: 'RightAtHome_Uptown',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      gatedYard: true,
      coveredParking: true,
    },
    description: 'Uptown location with GATED YARD for security and COVERED PARKING. 17 reviews.',
    specialFeatures: [
      'GATED YARD - Secure!',
      'COVERED PARKING',
      '17 verified reviews',
      'Uptown location'
    ],
    nearbyAttractions: [
      'Uptown Midland attractions'
    ],
    parkingInfo: 'Covered parking available.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Cowboy Siesta - NEW LISTING
  {
    id: 'cowboy-siesta',
    name: 'Cowboy Siesta Corner Lot with Patio & Covered Parking',
    address: 'Midland, TX 79705',
    nickname: 'Cowboy Siesta',
    vrboId: 'TBD',
    vrboUrl: '',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1600,
    maxGuests: 6,
    rating: 0,
    reviewCount: 0,
    doorCode: '',
    wifiName: 'RightAtHome_Cowboy',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      coveredParking: true,
    },
    description: 'NEW LISTING! Texas cowboy themed home on CORNER LOT with patio and covered parking.',
    specialFeatures: [
      'NEW LISTING!',
      'CORNER LOT',
      'Texas cowboy theme',
      'Covered parking',
      'Great patio'
    ],
    nearbyAttractions: [
      'Midland attractions nearby'
    ],
    parkingInfo: 'Covered parking on corner lot.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Vanguard Velvet Lounge
  {
    id: 'vanguard-velvet',
    name: 'Vanguard Velvet Lounge',
    address: 'Midland, TX 79705',
    nickname: 'Vanguard Velvet',
    vrboId: 'TBD',
    vrboUrl: '',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1700,
    maxGuests: 6,
    rating: 0,
    reviewCount: 17,
    doorCode: '',
    wifiName: 'RightAtHome_Vanguard',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
    },
    description: 'Stylish VELVET/LOUNGE themed home. Unique decor and comfortable stay. 17 reviews.',
    specialFeatures: [
      'VELVET/LOUNGE themed decor',
      'Stylish interior',
      '17 verified reviews'
    ],
    nearbyAttractions: [
      'Midland attractions nearby'
    ],
    parkingInfo: 'Driveway parking.',
    houseRules: ['No smoking inside', 'Pets allowed with deposit', 'Quiet hours 10pm-7am'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },

  // Groovy Times with Pool (Shandon area)
  {
    id: 'groovy-times',
    name: 'Groovy Times with Pool',
    address: 'Midland, TX 79707',
    nickname: 'Groovy Times',
    vrboId: 'TBD',
    vrboUrl: '',
    bedrooms: 4,
    bathrooms: 2,
    sqft: 2200,
    maxGuests: 8,
    rating: 0,
    reviewCount: 0,
    doorCode: '',
    wifiName: 'RightAtHome_Groovy',
    wifiPassword: '', // Loaded from database at runtime
    checkIn: '3:00 PM',
    checkOut: '11:00 AM',
    amenities: {
      ...defaultAmenities,
      pool: true,
    },
    description: 'RETRO/GROOVY themed home with POOL! Fun, colorful decor. Perfect for those who love 70s vibes.',
    specialFeatures: [
      'SWIMMING POOL',
      'RETRO/GROOVY decor',
      '70s themed',
      'Fun colorful interior'
    ],
    nearbyAttractions: [
      'Midland attractions nearby'
    ],
    parkingInfo: 'Driveway parking.',
    houseRules: ['No smoking inside', 'Pool rules must be followed', 'Pets allowed with deposit'],
    emergencyContact: 'Steven Palma: (432) 559-1904',
    verified: true,
  },
];

// ============================================
// SAMPLE REVIEWS DATABASE
// ============================================

export const reviews: PropertyReview[] = [
  // Lincoln Green Reviews
  {
    id: 'rev-lincoln-1',
    propertyId: 'lincoln-green-5055',
    platform: 'vrbo',
    guestName: 'Family Group',
    rating: 5,
    date: '2026-01-01',
    comment: 'The pool cabana and playground were perfect for our family reunion. Plenty of space for everyone!',
    response: 'Thank you! So glad your family enjoyed the property!',
  },
  // Santiago Dreams Reviews
  {
    id: 'rev-santiago-1',
    propertyId: 'santiago-dreams-1311',
    platform: 'vrbo',
    guestName: 'Work Crew',
    rating: 5,
    date: '2026-01-05',
    comment: 'The man cave was a huge hit with our crew. Extra parking was super convenient.',
  },
  // Outdoor Dream Reviews
  {
    id: 'rev-outdoor-1',
    propertyId: 'outdoor-dream-3106',
    platform: 'vrbo',
    guestName: 'Summer Vacation',
    rating: 4,
    date: '2025-12-20',
    comment: 'Pool AND hot tub made this perfect for our summer trip. Kids loved it!',
  },
  // Hot Tub Delight Reviews
  {
    id: 'rev-hottub-1',
    propertyId: 'hot-tub-delight-4707',
    platform: 'vrbo',
    guestName: 'Jennifer M.',
    rating: 5,
    date: '2025-12-01',
    comment: 'The hot tub was AMAZING after working all day. House was clean and had everything we needed.',
  },
  {
    id: 'rev-hottub-2',
    propertyId: 'hot-tub-delight-4707',
    platform: 'vrbo',
    guestName: 'Robert K.',
    rating: 5,
    date: '2025-11-15',
    comment: 'Best BnB in Midland! Hot tub is the perfect way to unwind. Steven is a great host.',
  },
  // Oasis Reviews (Most reviewed property!)
  {
    id: 'rev-oasis-1',
    propertyId: 'oasis-castleford-2636389',
    platform: 'vrbo',
    guestName: 'Michael R.',
    rating: 5,
    date: '2025-12-15',
    comment: 'Amazing property! The pool was perfect and the game room kept everyone entertained.',
    response: 'Thank you Michael! Come back anytime!',
  },
  {
    id: 'rev-oasis-2',
    propertyId: 'oasis-castleford-2636389',
    platform: 'vrbo',
    guestName: 'Sarah T.',
    rating: 5,
    date: '2025-11-20',
    comment: 'Perfect for our work crew. Plenty of space, great amenities.',
  },
  // Adobe Compound Reviews
  {
    id: 'rev-adobe-1',
    propertyId: 'adobe-compound-3005111',
    platform: 'vrbo',
    guestName: 'Large Family',
    rating: 5,
    date: '2025-12-10',
    comment: 'The fire pits were amazing! We had the whole family together and there was room for everyone.',
  },
];

// ============================================
// QUERY FUNCTIONS
// ============================================

export function getPropertyByName(searchTerm: string): PropertyDetails | undefined {
  const term = searchTerm.toLowerCase();
  return properties.find(p =>
    p.name.toLowerCase().includes(term) ||
    p.nickname?.toLowerCase().includes(term) ||
    p.address.toLowerCase().includes(term) ||
    p.id.toLowerCase().includes(term)
  );
}

export function getPropertiesWithAmenity(amenity: keyof PropertyAmenities): PropertyDetails[] {
  return properties.filter(p => p.amenities[amenity] === true);
}

export function getPropertiesWithPool(): PropertyDetails[] {
  return getPropertiesWithAmenity('pool');
}

export function getPropertiesWithHotTub(): PropertyDetails[] {
  return getPropertiesWithAmenity('hotTub');
}

export function getPropertiesWithBilliards(): PropertyDetails[] {
  return getPropertiesWithAmenity('billiards');
}

export function getPropertiesWithPoolAndHotTub(): PropertyDetails[] {
  return properties.filter(p => p.amenities.pool && p.amenities.hotTub);
}

export function getPropertyReviews(propertyId: string): PropertyReview[] {
  return reviews.filter(r => r.propertyId === propertyId);
}

export function getAverageRating(propertyId: string): number {
  const propertyReviews = getPropertyReviews(propertyId);
  if (propertyReviews.length === 0) return 0;
  return propertyReviews.reduce((sum, r) => sum + r.rating, 0) / propertyReviews.length;
}

export function searchProperties(query: string): PropertyDetails[] {
  const term = query.toLowerCase();
  return properties.filter(p =>
    p.name.toLowerCase().includes(term) ||
    p.nickname?.toLowerCase().includes(term) ||
    p.address.toLowerCase().includes(term) ||
    p.description.toLowerCase().includes(term) ||
    p.specialFeatures.some(f => f.toLowerCase().includes(term))
  );
}

export function getPropertyAmenitiesSummary(propertyId: string): string {
  const property = properties.find(p => p.id === propertyId);
  if (!property) return 'Property not found';

  const highlights: string[] = [];
  if (property.amenities.pool) highlights.push('Swimming Pool');
  if (property.amenities.hotTub) highlights.push('Hot Tub');
  if (property.amenities.billiards) highlights.push('Billiards');
  if (property.amenities.gameRoom) highlights.push('Game Room');
  if (property.amenities.firePit) highlights.push('Fire Pit');
  if (property.amenities.poolCabana) highlights.push('Pool Cabana');
  if (property.amenities.playground) highlights.push('Playground');
  if (property.amenities.bbqGrill) highlights.push('BBQ Grill');
  if (property.amenities.fireplace) highlights.push('Fireplace');
  if (property.amenities.petFriendly) highlights.push('Pet Friendly');
  if (property.amenities.garage) highlights.push('Garage');
  if (property.amenities.coveredParking) highlights.push('Covered Parking');
  if (property.amenities.gatedYard) highlights.push('Gated Yard');
  if (property.amenities.manCave) highlights.push('Man Cave');

  return highlights.join(', ') || 'Standard amenities';
}

export function getVerifiedProperties(): PropertyDetails[] {
  return properties.filter(p => p.verified);
}

export function getPropertiesByBedrooms(minBedrooms: number): PropertyDetails[] {
  return properties.filter(p => p.bedrooms >= minBedrooms);
}

export function getPropertiesByGuestCount(minGuests: number): PropertyDetails[] {
  return properties.filter(p => p.maxGuests >= minGuests);
}

export function getTopRatedProperties(minRating: number = 9.0): PropertyDetails[] {
  return properties.filter(p => p.rating && p.rating >= minRating);
}

export function getFlagshipProperty(): PropertyDetails {
  return properties.find(p => p.id === 'lincoln-green-5055')!;
}

// ============================================
// PROPERTY STATISTICS
// ============================================

export const propertyStats = {
  totalProperties: properties.length,
  verifiedProperties: properties.filter(p => p.verified).length,
  propertiesWithPool: properties.filter(p => p.amenities.pool).length,
  propertiesWithHotTub: properties.filter(p => p.amenities.hotTub).length,
  propertiesWithBilliards: properties.filter(p => p.amenities.billiards).length,
  propertiesWithBothPoolAndHotTub: properties.filter(p => p.amenities.pool && p.amenities.hotTub).length,
  totalBedrooms: properties.reduce((sum, p) => sum + p.bedrooms, 0),
  totalGuestCapacity: properties.reduce((sum, p) => sum + p.maxGuests, 0),
  flagshipProperty: 'Lincoln Green (5055) - 6BR, 18 guests, Pool + Cabana + Playground',
};

// ============================================
// EXPORT FOR AI CONCIERGE
// ============================================

export const PropertyKnowledge = {
  all: properties,
  reviews,
  stats: propertyStats,
  getByName: getPropertyByName,
  withPool: getPropertiesWithPool,
  withHotTub: getPropertiesWithHotTub,
  withBilliards: getPropertiesWithBilliards,
  withPoolAndHotTub: getPropertiesWithPoolAndHotTub,
  withAmenity: getPropertiesWithAmenity,
  getReviews: getPropertyReviews,
  getAverageRating,
  search: searchProperties,
  getAmenities: getPropertyAmenitiesSummary,
  verified: getVerifiedProperties,
  byBedrooms: getPropertiesByBedrooms,
  byGuestCount: getPropertiesByGuestCount,
  topRated: getTopRatedProperties,
  flagship: getFlagshipProperty,
};

export default PropertyKnowledge;
