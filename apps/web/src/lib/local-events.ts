/**
 * Right at Home BnB - Local Events Service
 * Midland, TX events and activities for AI Concierge
 * @author ECHO OMEGA PRIME
 */

export interface LocalEvent {
  id: string;
  name: string;
  description: string;
  venue: string;
  address: string;
  date: string;
  time: string;
  category: 'sports' | 'music' | 'festival' | 'community' | 'dining' | 'entertainment' | 'business';
  price?: string;
  url?: string;
  recurring?: boolean;
}

export interface LocalAttraction {
  name: string;
  description: string;
  address: string;
  hours: string;
  category: 'museum' | 'park' | 'entertainment' | 'shopping' | 'dining' | 'sports' | 'nature';
  website?: string;
  phone?: string;
}

// ============================================
// MIDLAND LOCAL ATTRACTIONS
// ============================================

export const attractions: LocalAttraction[] = [
  {
    name: 'Petroleum Museum',
    description: 'World-class museum showcasing the history of oil and gas in the Permian Basin. Interactive exhibits, outdoor oil field equipment, and educational programs.',
    address: '1500 I-20 W, Midland, TX 79701',
    hours: 'Tue-Sat 10am-5pm, Sun 2pm-5pm',
    category: 'museum',
    website: 'https://petroleummuseum.org',
    phone: '(432) 683-4403',
  },
  {
    name: 'I-20 Wildlife Preserve',
    description: '100+ acres of wetlands, prairie, and forest. Great for bird watching, hiking, and nature photography.',
    address: '2201 S Midland Dr, Midland, TX 79703',
    hours: 'Dawn to dusk daily',
    category: 'nature',
  },
  {
    name: 'Museum of the Southwest',
    description: 'Art museum with rotating exhibits, planetarium shows, and a children\'s museum. Located in historic Turner Mansion.',
    address: '1705 W Missouri Ave, Midland, TX 79701',
    hours: 'Tue-Sat 10am-5pm, Sun 2pm-5pm',
    category: 'museum',
    website: 'https://museumsw.org',
    phone: '(432) 683-2882',
  },
  {
    name: 'Midland RockHounds Baseball',
    description: 'Minor League Baseball (AA affiliate of Oakland Athletics). Family-friendly fun at Momentum Bank Ballpark.',
    address: '5514 Champions Dr, Midland, TX 79706',
    hours: 'Season: April-September',
    category: 'sports',
    website: 'https://www.milb.com/midland',
  },
  {
    name: 'Midland Park Mall',
    description: 'Largest shopping center in the Permian Basin with Dillard\'s, JCPenney, and 100+ stores.',
    address: '4511 N Midkiff Rd, Midland, TX 79705',
    hours: 'Mon-Sat 10am-9pm, Sun 12pm-6pm',
    category: 'shopping',
  },
  {
    name: 'Centennial Park & Pool',
    description: 'Public park with walking trails, playgrounds, splash pad, and Olympic-sized swimming pool.',
    address: '2000 N Fairgrounds Rd, Midland, TX 79705',
    hours: 'Pool: Summer months',
    category: 'park',
  },
  {
    name: 'George W. Bush Childhood Home',
    description: 'The restored childhood home of President George W. Bush. Tour the 1950s-era home and learn about the Bush family.',
    address: '1412 W Ohio Ave, Midland, TX 79701',
    hours: 'Tue-Sat 10am-5pm, Sun 2pm-5pm',
    category: 'museum',
    phone: '(432) 685-1112',
  },
  {
    name: 'Cinergy Entertainment',
    description: 'Entertainment complex with bowling, laser tag, escape rooms, and full-service restaurant.',
    address: '4600 N Garfield St, Midland, TX 79705',
    hours: 'Sun-Thu 11am-10pm, Fri-Sat 11am-12am',
    category: 'entertainment',
    website: 'https://www.cinergy.com/midland',
  },
];

// ============================================
// SAMPLE EVENTS (Updated dynamically in production)
// ============================================

export const upcomingEvents: LocalEvent[] = [
  // January 2026 Events
  {
    id: 'evt-rockhounds-spring',
    name: 'RockHounds Spring Training',
    description: 'Midland RockHounds baseball spring training begins! Watch future MLB stars prepare for the season.',
    venue: 'Momentum Bank Ballpark',
    address: '5514 Champions Dr, Midland, TX 79706',
    date: '2026-03-15',
    time: '6:00 PM',
    category: 'sports',
    price: '$12-25',
  },
  {
    id: 'evt-petroleum-exhibit',
    name: 'Drilling Into History: New Exhibit',
    description: 'New interactive exhibit exploring the evolution of drilling technology from the 1920s to today.',
    venue: 'Petroleum Museum',
    address: '1500 I-20 W, Midland, TX 79701',
    date: '2026-01-20',
    time: '10:00 AM',
    category: 'community',
    price: 'Museum admission',
  },
  {
    id: 'evt-food-truck-friday',
    name: 'Food Truck Friday',
    description: 'Weekly gathering of local food trucks at Centennial Plaza. Live music, family activities.',
    venue: 'Centennial Plaza',
    address: 'Downtown Midland',
    date: '2026-01-17',
    time: '5:00 PM - 9:00 PM',
    category: 'dining',
    price: 'Free entry, pay for food',
    recurring: true,
  },
  {
    id: 'evt-permian-basin-fair',
    name: 'Permian Basin Fair & Exposition',
    description: 'Annual fair with livestock shows, carnival rides, concerts, and food vendors.',
    venue: 'Ector County Coliseum',
    address: '4201 Andrews Hwy, Odessa, TX 79762',
    date: '2026-09-10',
    time: 'All Day',
    category: 'festival',
    price: '$10-15',
  },
  {
    id: 'evt-wine-walk',
    name: 'Downtown Wine Walk',
    description: 'Sample wines from Texas wineries while strolling through historic downtown Midland shops.',
    venue: 'Downtown Midland',
    address: 'Wall Street, Midland',
    date: '2026-02-14',
    time: '5:00 PM - 9:00 PM',
    category: 'dining',
    price: '$25',
  },
  {
    id: 'evt-planetarium',
    name: 'Planetarium Star Show',
    description: 'Weekly planetarium show featuring current night sky and space exploration topics.',
    venue: 'Museum of the Southwest',
    address: '1705 W Missouri Ave, Midland, TX 79701',
    date: '2026-01-18',
    time: '2:00 PM',
    category: 'entertainment',
    price: '$5',
    recurring: true,
  },
  {
    id: 'evt-farmers-market',
    name: 'Midland Farmers Market',
    description: 'Fresh local produce, artisan goods, and handmade crafts every Saturday.',
    venue: 'Museum of the Southwest Courtyard',
    address: '1705 W Missouri Ave, Midland, TX 79701',
    date: '2026-01-18',
    time: '8:00 AM - 12:00 PM',
    category: 'community',
    price: 'Free',
    recurring: true,
  },
];

// ============================================
// RESTAURANTS & DINING
// ============================================

export interface Restaurant {
  name: string;
  cuisine: string;
  description: string;
  address: string;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  rating: number;
  hours: string;
  phone?: string;
  reservations?: boolean;
}

export const restaurants: Restaurant[] = [
  {
    name: 'The Garlic Press',
    cuisine: 'American Fine Dining',
    description: 'Upscale dining with creative American cuisine. Great steaks and seafood.',
    address: '2200 W Wadley Ave, Midland, TX 79705',
    priceRange: '$$$',
    rating: 4.5,
    hours: 'Tue-Sat 5pm-10pm',
    reservations: true,
  },
  {
    name: 'Mulberry Cafe',
    cuisine: 'American/Brunch',
    description: 'Popular brunch spot with homemade pastries, fresh salads, and sandwiches.',
    address: '3211 W Wadley Ave, Midland, TX 79705',
    priceRange: '$$',
    rating: 4.7,
    hours: 'Mon-Sat 7am-3pm',
  },
  {
    name: 'Wall Street Bar & Grill',
    cuisine: 'American/Bar',
    description: 'Downtown institution. Great burgers, wings, and cold beer.',
    address: '115 E Wall St, Midland, TX 79701',
    priceRange: '$$',
    rating: 4.3,
    hours: 'Mon-Sat 11am-2am',
  },
  {
    name: 'KD\'s Bar-B-Q',
    cuisine: 'BBQ',
    description: 'Texas BBQ at its finest. Brisket, ribs, and all the fixings.',
    address: '4901 E Hwy 80, Midland, TX 79706',
    priceRange: '$$',
    rating: 4.6,
    hours: 'Wed-Sat 11am-8pm',
  },
  {
    name: 'Rosa\'s Cafe & Tortilla Factory',
    cuisine: 'Tex-Mex',
    description: 'Fresh tortillas made daily. Great breakfast tacos and enchiladas.',
    address: '4610 N Midkiff Rd, Midland, TX 79705',
    priceRange: '$',
    rating: 4.4,
    hours: 'Daily 6am-10pm',
  },
  {
    name: 'Gerardo\'s Casita',
    cuisine: 'Mexican',
    description: 'Authentic Mexican food. Known for their fajitas and margaritas.',
    address: '2609 W Cuthbert Ave, Midland, TX 79701',
    priceRange: '$$',
    rating: 4.5,
    hours: 'Daily 11am-10pm',
  },
  {
    name: 'Basin Burger House',
    cuisine: 'Burgers',
    description: 'Gourmet burgers with creative toppings. Great local craft beer selection.',
    address: '400 N Main St, Midland, TX 79701',
    priceRange: '$$',
    rating: 4.5,
    hours: 'Mon-Sat 11am-9pm',
  },
  {
    name: 'Luigi\'s Italian Restaurant',
    cuisine: 'Italian',
    description: 'Family-owned Italian restaurant. Homemade pasta and traditional recipes.',
    address: '111 N Big Spring St, Midland, TX 79701',
    priceRange: '$$',
    rating: 4.3,
    hours: 'Mon-Sat 11am-9pm',
  },
];

// ============================================
// BARS & NIGHTLIFE
// ============================================

export interface Bar {
  name: string;
  type: string;
  description: string;
  address: string;
  hours: string;
  features: string[];
}

export const bars: Bar[] = [
  {
    name: 'Hemingway\'s Watering Hole',
    type: 'Craft Cocktail Bar',
    description: 'Upscale cocktail lounge with creative drinks and live music on weekends.',
    address: '211 W Texas Ave, Midland, TX 79701',
    hours: 'Wed-Sat 5pm-2am',
    features: ['Craft cocktails', 'Live music', 'Rooftop patio'],
  },
  {
    name: 'The Bar',
    type: 'Sports Bar',
    description: 'Great place to watch the game. Multiple TVs, pool tables, and cold beer.',
    address: '3500 N Big Spring St, Midland, TX 79705',
    hours: 'Daily 11am-2am',
    features: ['Sports TVs', 'Pool tables', 'Happy hour'],
  },
  {
    name: 'Bourbon Street',
    type: 'Nightclub',
    description: 'High-energy nightclub with DJ, dancing, and VIP sections.',
    address: '2301 W Industrial Ave, Midland, TX 79701',
    hours: 'Thu-Sat 9pm-2am',
    features: ['DJ', 'Dancing', 'VIP sections'],
  },
  {
    name: 'Cork & Pig Tavern',
    type: 'Wine Bar',
    description: 'Sophisticated wine bar with extensive wine list and tapas menu.',
    address: '3001 N Big Spring St, Midland, TX 79705',
    hours: 'Mon-Sat 4pm-11pm',
    features: ['Wine selection', 'Tapas', 'Outdoor seating'],
  },
];

// ============================================
// QUERY FUNCTIONS
// ============================================

export function getEventsByDateRange(startDate: string, endDate: string): LocalEvent[] {
  return upcomingEvents.filter(e => e.date >= startDate && e.date <= endDate);
}

export function getEventsByCategory(category: LocalEvent['category']): LocalEvent[] {
  return upcomingEvents.filter(e => e.category === category);
}

export function getRecurringEvents(): LocalEvent[] {
  return upcomingEvents.filter(e => e.recurring);
}

export function searchRestaurants(query: string): Restaurant[] {
  const term = query.toLowerCase();
  return restaurants.filter(r =>
    r.name.toLowerCase().includes(term) ||
    r.cuisine.toLowerCase().includes(term) ||
    r.description.toLowerCase().includes(term)
  );
}

export function getRestaurantsByPriceRange(priceRange: Restaurant['priceRange']): Restaurant[] {
  return restaurants.filter(r => r.priceRange === priceRange);
}

export function getAttractionsByCategory(category: LocalAttraction['category']): LocalAttraction[] {
  return attractions.filter(a => a.category === category);
}

// ============================================
// EXPORT FOR AI CONCIERGE
// ============================================

export const LocalGuide = {
  attractions,
  events: upcomingEvents,
  restaurants,
  bars,
  getEventsByDate: getEventsByDateRange,
  getEventsByCategory,
  getRecurringEvents,
  searchRestaurants,
  getRestaurantsByPrice: getRestaurantsByPriceRange,
  getAttractionsByCategory,
};

export default LocalGuide;
