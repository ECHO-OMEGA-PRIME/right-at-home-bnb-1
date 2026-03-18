/**
 * RAH Backend - Cloudflare Worker
 * Emergency deployment to fix API failures
 */

// Steven's actual property data (20 houses in Midland, TX)
const PROPERTIES = [
  {
    id: "2638481",
    name: "Right At Home-Midland Hot Tub",
    address: "4707A Dentcrest, Midland, TX 79707",
    price: 149,
    beds: 3,
    baths: 2,
    sqft: 1200,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
    ],
    amenities: ["Hot Tub", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Pet Friendly"],
    description: "Relax and unwind in this beautiful home featuring a private hot tub, perfect for extended stays in Midland.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Hot tub hours: 7 AM - 11 PM",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "2634718",
    name: "Right At Home-Midland Patio Home",
    address: "2702 N Garfield, Midland, TX 79705",
    price: 135,
    beds: 2,
    baths: 2,
    sqft: 1050,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"
    ],
    amenities: ["Private Patio", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking"],
    description: "Charming patio home perfect for business travelers and extended stays with outdoor space for relaxation.",
    available: false,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "2643784",
    name: "Right At Home-Midland Retreat",
    address: "3210 Chelsea, Midland, TX 79707",
    price: 165,
    beds: 4,
    baths: 3,
    sqft: 1800,
    images: [
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
    ],
    amenities: ["WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Backyard", "Pet Friendly"],
    description: "Spacious retreat perfect for families and groups visiting Midland for business or leisure.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "2643822",
    name: "Right At Home-Midland Destination Getaway",
    address: "4801 Storey Ave, Midland, TX 79707",
    price: 175,
    beds: 3,
    baths: 2,
    sqft: 1450,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800"
    ],
    amenities: ["WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Game Room"],
    description: "Your destination getaway in Midland featuring modern amenities and entertainment space.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "2643508",
    name: "Right At Home-Midland Northtown Place",
    address: "4535 Gleneagles, Midland, TX 79707",
    price: 155,
    beds: 3,
    baths: 2,
    sqft: 1300,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"
    ],
    amenities: ["WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Office Space"],
    description: "Comfortable Northtown location perfect for business travelers and extended stays.",
    available: false,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "3355618",
    name: "Right At Home-Midland Park View",
    address: "2000 Douglas, Midland, TX 79705",
    price: 145,
    beds: 3,
    baths: 2,
    sqft: 1250,
    images: [
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
    ],
    amenities: ["Park View", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking"],
    description: "Beautiful park view home offering tranquil surroundings and convenient location.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "3477668",
    name: "Right At Home-Midland Monterrey House",
    address: "1605 Monterrey, Midland, TX 79701",
    price: 140,
    beds: 3,
    baths: 2,
    sqft: 1150,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800"
    ],
    amenities: ["WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Pet Friendly"],
    description: "Charming Monterrey house perfect for comfortable extended stays in central Midland.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "3559249",
    name: "Right At Home-Midland Vanguard Velvet Lounge",
    address: "6613 Vanguard, Midland, TX 79707",
    price: 195,
    beds: 4,
    baths: 3,
    sqft: 2000,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"
    ],
    amenities: ["Luxury Lounge", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Entertainment Area"],
    description: "Luxurious velvet lounge experience with premium amenities and spacious layout.",
    available: false,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "2636389",
    name: "Right At Home-Midland Oasis",
    address: "5005 Castleford Dr, Midland, TX 79707",
    price: 180,
    beds: 4,
    baths: 3,
    sqft: 1750,
    images: [
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
    ],
    amenities: ["Pool Access", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Pet Friendly"],
    description: "Your oasis in Midland featuring resort-style amenities and comfortable accommodations.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Pool hours: 8 AM - 10 PM",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "3005111",
    name: "Right At Home-Midland Adobe Compound",
    address: "2309 W Golf Course, Midland, TX 79701",
    price: 210,
    beds: 5,
    baths: 4,
    sqft: 2400,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800"
    ],
    amenities: ["Golf Course View", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Adobe Architecture"],
    description: "Stunning adobe compound with golf course views, perfect for large groups and special occasions.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4179271",
    name: "Right At Home-Midland Santiago Dreams",
    address: "1311 Daventry, Midland, TX 79701",
    price: 160,
    beds: 3,
    baths: 2,
    sqft: 1350,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"
    ],
    amenities: ["WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Garden"],
    description: "Dream home in Santiago style with beautiful garden space and modern amenities.",
    available: false,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4056016",
    name: "Right At Home-Midland Uptown Place",
    address: "4533 Gleneagles, Midland, TX 79707",
    price: 170,
    beds: 3,
    baths: 2,
    sqft: 1400,
    images: [
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
    ],
    amenities: ["WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Modern Design"],
    description: "Uptown place featuring modern design and convenient location in desirable neighborhood.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "3724481",
    name: "Right At Home-Midland Clermont House",
    address: "1408 Mogford, Midland, TX 79701",
    price: 150,
    beds: 3,
    baths: 2,
    sqft: 1200,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800"
    ],
    amenities: ["WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Study Room"],
    description: "Elegant Clermont house with dedicated study space, perfect for business travelers.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4437486",
    name: "Right At Home-Midland Posh & Private",
    address: "1426 Lanham, Midland, TX 79701",
    price: 185,
    beds: 3,
    baths: 3,
    sqft: 1600,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"
    ],
    amenities: ["Private Entrance", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Luxury Finishes"],
    description: "Posh and private retreat with luxury finishes and complete privacy for discerning guests.",
    available: false,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4471713",
    name: "Right At Home-Midland Most Marvelous",
    address: "6001 Oriole, Midland, TX 79707",
    price: 200,
    beds: 4,
    baths: 3,
    sqft: 1900,
    images: [
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
    ],
    amenities: ["Premium Location", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "High-End Appliances"],
    description: "Most marvelous property featuring premium location and high-end appliances throughout.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4581977",
    name: "Right At Home-Midland Sprawling Ranch",
    address: "5800 Lincoln green, Midland, TX 79707",
    price: 220,
    beds: 5,
    baths: 4,
    sqft: 2600,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800"
    ],
    amenities: ["Sprawling Layout", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Large Yard"],
    description: "Sprawling ranch home with expansive layout and large yard, perfect for big groups.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4135262",
    name: "Right At Home-Midland Cowboy Siesta",
    address: "4217 Siesta ln, Midland, TX 79707",
    price: 155,
    beds: 3,
    baths: 2,
    sqft: 1300,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"
    ],
    amenities: ["Western Theme", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Fire Pit"],
    description: "Cowboy-themed siesta retreat with authentic Western charm and outdoor fire pit.",
    available: false,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Fire pit hours: 7 AM - 11 PM",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4700881",
    name: "Right At Home-Midland Outdoor Dream",
    address: "3104 Humble, Midland, TX 79707",
    price: 175,
    beds: 4,
    baths: 3,
    sqft: 1750,
    images: [
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
    ],
    amenities: ["Outdoor Kitchen", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "BBQ Area"],
    description: "Outdoor dream home featuring outdoor kitchen and BBQ area, perfect for entertaining.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Outdoor area hours: 7 AM - 11 PM",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4750070",
    name: "Right At Home-Midland Saddle Club",
    address: "3109 Daventry, Midland, TX 79707",
    price: 165,
    beds: 3,
    baths: 2,
    sqft: 1400,
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      "https://images.unsplash.com/photo-1515263487990-61b07816b6e0?w=800"
    ],
    amenities: ["Equestrian Theme", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Game Room"],
    description: "Saddle Club themed home with equestrian charm and dedicated game room for entertainment.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  },
  {
    id: "4894280",
    name: "Right At Home-Midland Groovy Times",
    address: "3528 Shandon, Midland, TX 79707",
    price: 160,
    beds: 3,
    baths: 2,
    sqft: 1350,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"
    ],
    amenities: ["Retro Design", "WiFi", "Full Kitchen", "Washer/Dryer", "Parking", "Music Room"],
    description: "Groovy times await in this retro-designed home featuring a dedicated music room.",
    available: true,
    rules: [
      "No smoking inside the property",
      "Quiet hours: 10 PM - 8 AM",
      "Maximum occupancy strictly enforced",
      "Music room hours: 9 AM - 10 PM",
      "Check-in: 3 PM, Check-out: 11 AM"
    ],
    contact: { phone: "+14329006300", email: "steven@rah-midland.com", manager: "Steven Palma" }
  }
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Weather API key (from env file)
const WEATHER_API_KEY = '77b5b040303a47a1a3953924252803';

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Health check
    if (path === '/health' || path === '/api/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'RAH Backend Worker',
        properties_count: PROPERTIES.length
      }), { headers: corsHeaders });
    }

    // Properties endpoints
    if (path === '/api/properties' || path === '/properties') {
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = parseInt(url.searchParams.get('limit')) || 50;
      const search = url.searchParams.get('search') || '';

      let filteredProperties = PROPERTIES;

      if (search) {
        filteredProperties = PROPERTIES.filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.address.toLowerCase().includes(search.toLowerCase())
        );
      }

      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedProperties = filteredProperties.slice(start, end);

      return new Response(JSON.stringify({
        properties: paginatedProperties,
        total: filteredProperties.length,
        page,
        limit,
        totalPages: Math.ceil(filteredProperties.length / limit)
      }), { headers: corsHeaders });
    }

    // Single property
    if (path.match(/^\/api\/properties\/[^\/]+$/)) {
      const propertyId = path.split('/').pop();
      const property = PROPERTIES.find(p => p.id === propertyId);

      if (!property) {
        return new Response(JSON.stringify({ error: 'Property not found' }), {
          status: 404,
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify(property), { headers: corsHeaders });
    }

    // Weather endpoint
    if (path === '/api/weather' || path === '/weather') {
      try {
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=Midland,TX&appid=${WEATHER_API_KEY}&units=imperial`;
        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
          throw new Error('Weather API failed');
        }

        const weatherData = await weatherResponse.json();

        const formattedWeather = {
          temperature: Math.round(weatherData.main.temp),
          description: weatherData.weather[0].description,
          icon: weatherData.weather[0].icon,
          humidity: weatherData.main.humidity,
          wind_speed: weatherData.wind.speed,
          city: 'Midland, TX',
          last_updated: new Date().toISOString()
        };

        return new Response(JSON.stringify(formattedWeather), { headers: corsHeaders });

      } catch (error) {
        // Fallback weather data
        return new Response(JSON.stringify({
          temperature: 72,
          description: 'partly cloudy',
          icon: '02d',
          humidity: 45,
          wind_speed: 8.5,
          city: 'Midland, TX',
          last_updated: new Date().toISOString(),
          note: 'Using fallback data'
        }), { headers: corsHeaders });
      }
    }

    // Stats endpoint
    if (path === '/api/stats' || path === '/stats') {
      const available = PROPERTIES.filter(p => p.available).length;
      const avgPrice = Math.round(PROPERTIES.reduce((sum, p) => sum + p.price, 0) / PROPERTIES.length);

      return new Response(JSON.stringify({
        total_properties: PROPERTIES.length,
        available_properties: available,
        occupied_properties: PROPERTIES.length - available,
        average_price: avgPrice,
        total_beds: PROPERTIES.reduce((sum, p) => sum + p.beds, 0),
        total_baths: PROPERTIES.reduce((sum, p) => sum + p.baths, 0)
      }), { headers: corsHeaders });
    }

    // Contact/manager info
    if (path === '/api/contact' || path === '/contact') {
      return new Response(JSON.stringify({
        manager: 'Steven Palma',
        phone: '+14329006300',
        email: 'steven@rah-midland.com',
        website: 'https://rah-midland.com',
        address: 'Midland, Texas',
        hours: 'Available 24/7 for emergencies'
      }), { headers: corsHeaders });
    }

    // 404 for unknown endpoints
    return new Response(JSON.stringify({
      error: 'Not Found',
      path,
      available_endpoints: [
        '/health',
        '/api/properties',
        '/api/properties/{id}',
        '/api/weather',
        '/api/stats',
        '/api/contact'
      ]
    }), {
      status: 404,
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Event listener for Cloudflare Workers
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Export for ES modules (if needed)
export default { fetch: handleRequest };