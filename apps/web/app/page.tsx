'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  Home, Star, MapPin, Calendar, ChevronRight, Play, Pause,
  Wifi, Car, Coffee, Sparkles, Shield, Clock, ArrowRight,
  Phone, Mail, Droplets, Flame, LogIn
} from 'lucide-react';
import { properties as realProperties, PropertyDetails } from '@/lib/property-knowledge';

// Weather data type
interface WeatherData {
  temp: number;
  condition: string;
  emoji: string;
}

// Floating Header Component
const FloatingHeader = () => {
  const [dateTime, setDateTime] = useState<string>('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Update date/time every second
    const updateDateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      setDateTime(now.toLocaleDateString('en-US', options));
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);

    // Fetch weather
    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/weather');
        const data = await res.json();
        if (data.success && data.data) {
          setWeather({
            temp: Math.round(data.data.temp),
            condition: data.data.condition,
            emoji: getWeatherEmoji(data.data.condition),
          });
        } else if (data.temp) {
          setWeather({
            temp: data.temp,
            condition: data.condition,
            emoji: data.emoji || getWeatherEmoji(data.condition),
          });
        }
      } catch (error) {
        console.error('Weather fetch error:', error);
        setWeather({ temp: 72, condition: 'Clear', emoji: '☀️' });
      }
    };

    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 600000); // Refresh every 10 minutes

    // Handle scroll
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const getWeatherEmoji = (condition: string): string => {
    const emojis: Record<string, string> = {
      'Clear': '☀️',
      'Sunny': '☀️',
      'Clouds': '☁️',
      'Cloudy': '☁️',
      'Partly Cloudy': '⛅',
      'Rain': '🌧️',
      'Drizzle': '🌦️',
      'Thunderstorm': '⛈️',
      'Snow': '❄️',
      'Mist': '🌫️',
      'Fog': '🌫️',
      'Haze': '🌫️',
      'Dust': '💨',
      'Wind': '💨',
      'Tornado': '🌪️',
      'Hot': '🔥',
    };
    return emojis[condition] || '🌡️';
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-black/80 backdrop-blur-lg shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Date & Time */}
          <div className="flex items-center gap-2 text-white/80">
            <span className="text-lg">📅</span>
            <span className="text-sm font-medium">{dateTime}</span>
          </div>

          {/* Weather */}
          {weather && (
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-2xl">{weather.emoji}</span>
              <span className="text-sm font-medium">{weather.temp}°F</span>
              <span className="text-xs text-white/50 hidden sm:inline">Midland, TX</span>
            </div>
          )}

          {/* Login Button */}
          <Link
            href="/login"
            className="flex items-center gap-2 px-5 py-2 bg-[#500000] hover:bg-[#722F37] text-white rounded-full transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <LogIn className="w-4 h-4" />
            <span className="text-sm font-medium">Login</span>
          </Link>
        </div>
      </div>
    </motion.header>
  );
};

// Dynamic import for Three.js (client-only)
const HeroScene = dynamic(() => import('@/components/three/HeroScene'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-gradient-to-br from-[#1a0808] to-[#0a0505]" />
});

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Transform real properties for display
const getPropertyAmenities = (property: PropertyDetails): string[] => {
  const amenities: string[] = [];
  if (property.amenities.pool) amenities.push('Pool');
  if (property.amenities.hotTub) amenities.push('Hot Tub');
  if (property.amenities.bbqGrill) amenities.push('BBQ Grill');
  if (property.amenities.fireplace) amenities.push('Fireplace');
  if (property.amenities.petFriendly) amenities.push('Pet Friendly');
  if (property.amenities.garage) amenities.push('Garage');
  if (property.amenities.fencedYard) amenities.push('Fenced Yard');
  if (property.amenities.workFromHome) amenities.push('Work Setup');
  return amenities.slice(0, 4);
};

// Featured Properties - Real data from Steven's portfolio
const featuredProperties = realProperties.slice(0, 4).map((p, idx) => ({
  id: p.id,
  name: p.name,
  tagline: p.description.split('.')[0],
  address: p.address.split(',').slice(0, -1).join(','),
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  guests: p.maxGuests,
  price: p.amenities.pool && p.amenities.hotTub ? 349 : p.amenities.pool || p.amenities.hotTub ? 249 : p.bedrooms >= 3 ? 199 : 149,
  rating: p.rating || 4.9,
  reviews: p.reviewCount || 50,
  image: `/properties/${p.id}/main.webp`,
  amenities: getPropertyAmenities(p),
}));

// Property Card Component with 3D Effects
const PropertyCard = ({ property, index }: { property: typeof featuredProperties[0]; index: number }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      gsap.to(card, {
        rotateX: rotateX,
        rotateY: rotateY,
        duration: 0.5,
        ease: 'power2.out',
        transformPerspective: 1000
      });
    };

    const handleMouseLeave = () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.5,
        ease: 'power2.out'
      });
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <Link href={`/properties/${property.id}`}>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.15, duration: 0.6 }}
        className="property-card group cursor-pointer"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Image Container */}
        <div className="relative h-64 overflow-hidden rounded-t-2xl">
        <Image
          src={property.image}
          alt={property.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {/* Price Tag */}
        <div className="absolute top-4 right-4 px-4 py-2 glass-morphism rounded-full">
          <span className="text-white font-bold">${property.price}</span>
          <span className="text-white/70 text-sm">/night</span>
        </div>
        {/* Rating */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1 glass-morphism rounded-full">
            <Star className="w-4 h-4 text-[#d4a574] fill-[#d4a574]" />
            <span className="text-white font-semibold">{property.rating}</span>
            <span className="text-white/70 text-sm">({property.reviews})</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 bg-white/5 backdrop-blur-sm rounded-b-2xl border border-white/10 border-t-0">
        <h3 className="text-xl font-display font-bold text-white group-hover:text-[#d4a574] transition-colors">
          {property.name}
        </h3>
        <p className="text-[#d4a574] text-sm mt-1">{property.tagline}</p>
        <div className="flex items-center gap-1 mt-2 text-white/60 text-sm">
          <MapPin className="w-4 h-4" />
          {property.address}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 text-white/80 text-sm">
          <span>{property.bedrooms} Beds</span>
          <span className="w-1 h-1 bg-white/40 rounded-full" />
          <span>{property.bathrooms} Baths</span>
          <span className="w-1 h-1 bg-white/40 rounded-full" />
          <span>{property.guests} Guests</span>
        </div>

        {/* Amenities */}
        <div className="flex flex-wrap gap-2 mt-4">
          {property.amenities.slice(0, 3).map((amenity, i) => (
            <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/70">
              {amenity}
            </span>
          ))}
          {property.amenities.length > 3 && (
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/70">
              +{property.amenities.length - 3} more
            </span>
          )}
        </div>

        {/* CTA */}
        <div className="premium-button w-full mt-6 group/btn">
          <span>View Property</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
        </div>
      </div>
    </motion.div>
    </Link>
  );
};

// Stats Counter Component
const StatCounter = ({ value, suffix, label }: { value: number; suffix: string; label: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const duration = 2000;
          const steps = 60;
          const increment = value / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-5xl md:text-6xl font-display font-bold text-white">
        {count}{suffix}
      </div>
      <div className="text-[#d4a574] mt-2 text-lg">{label}</div>
    </div>
  );
};

// Main Landing Page
export default function LandingPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.9]);

  useEffect(() => {
    setIsLoaded(true);

    // GSAP animations for sections
    gsap.utils.toArray('.animate-section').forEach((section: any) => {
      gsap.fromTo(
        section,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            end: 'bottom 20%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0505] text-white overflow-x-hidden">
      {/* Floating Header */}
      <FloatingHeader />

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center justify-center"
      >
        {/* Three.js Background */}
        <HeroScene />

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-6 text-center">
          {/* Animated Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 glass-morphism rounded-full mb-8"
          >
            <Sparkles className="w-4 h-4 text-[#d4a574]" />
            <span className="text-sm text-white/90">Premier Midland, TX Vacation Rentals</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-tight"
          >
            <span className="neon-text-glow">Right at Home</span>
            <br />
            <span className="text-[#d4a574]">BnB</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 text-xl md:text-2xl text-white/70 max-w-2xl mx-auto"
          >
            Experience Texas hospitality at its finest. 22 curated properties in the heart of the Permian Basin.
          </motion.p>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <div className="flex flex-col items-center gap-2 text-white/50">
              <span className="text-sm">Scroll to explore</span>
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2"
              >
                <div className="w-1.5 h-3 bg-white/50 rounded-full" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-b from-[#0a0505] to-[#150808]">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCounter value={22} suffix="" label="Properties" />
            <StatCounter value={4.9} suffix="" label="Avg Rating" />
            <StatCounter value={500} suffix="+" label="Happy Guests" />
            <StatCounter value={98} suffix="%" label="5-Star Reviews" />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 animate-section">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.span className="text-[#d4a574] text-sm uppercase tracking-wider">
              About Right at Home
            </motion.span>
            <h2 className="text-4xl md:text-5xl font-display font-bold mt-4">
              Texas Hospitality, <span className="text-[#d4a574]">Elevated</span>
            </h2>
            <p className="mt-6 text-lg text-white/70 leading-relaxed">
              Founded by Steven Palma, Right at Home BnB brings together 22 exceptional properties
              in Midland, Texas. Each home is meticulously maintained, professionally cleaned,
              and equipped with everything you need for a comfortable stay. Whether you're here
              for business in the Permian Basin or exploring West Texas, we've got you covered.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
              {[
                { icon: Shield, label: 'Verified Homes' },
                { icon: Clock, label: '24/7 Support' },
                { icon: Sparkles, label: 'Pro Cleaning' },
                { icon: Wifi, label: 'Fast WiFi' }
              ].map((feature, i) => (
                <div key={i} className="stat-card text-center">
                  <feature.icon className="w-8 h-8 mx-auto text-[#d4a574]" />
                  <p className="mt-3 text-white/90 font-medium">{feature.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Properties Section */}
      <section id="properties" className="py-24 bg-gradient-to-b from-[#150808] to-[#0a0505]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 animate-section">
            <span className="text-[#d4a574] text-sm uppercase tracking-wider">
              Featured Properties
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-bold mt-4">
              Find Your Perfect <span className="text-[#d4a574]">Stay</span>
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              From cozy cottages to executive estates, discover the perfect home away from home.
            </p>
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProperties.map((property, index) => (
              <PropertyCard key={property.id} property={property} index={index} />
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center mt-12">
            <Link href="/properties" className="premium-button px-8 py-4 inline-flex">
              <span>View All 22 Properties</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-[#0a0505] to-[#1a0808]">
        <div className="container mx-auto px-6">
          <div className="glass-glow p-12 md:p-16 rounded-3xl text-center max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-display font-bold">
              Ready for Your <span className="neon-text-glow">Texas Adventure</span>?
            </h2>
            <p className="mt-4 text-white/70 text-lg max-w-2xl mx-auto">
              Book directly with us for the best rates and personalized service.
              Experience the difference of Right at Home hospitality.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="#properties" className="premium-button px-8 py-4 text-lg">
                <span>Book Now</span>
                <Calendar className="w-5 h-5" />
              </Link>
              <a
                href="tel:+14325591904"
                className="px-8 py-4 border border-white/20 rounded-xl text-white/90
                           hover:bg-white/10 transition-all duration-300 flex items-center gap-2"
              >
                <Phone className="w-5 h-5" />
                <span>Call Us</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-white/10">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Logo & About */}
            <div className="md:col-span-2">
              <Image
                src="/images/logo-light.png"
                alt="Right at Home Midland"
                width={220}
                height={180}
                className="h-auto max-w-[220px]"
              />
              <p className="mt-4 text-white/60 max-w-md">
                22 premium vacation rentals in the heart of the Permian Basin.
                Texas hospitality at its finest.
              </p>
              <div className="flex items-center gap-4 mt-6">
                <a
                  href="https://www.facebook.com/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  title="Facebook"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/accounts/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  title="Instagram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a
                  href="https://www.linkedin.com/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  title="LinkedIn"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-display font-bold text-white mb-4">Quick Links</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/properties" className="text-white/60 hover:text-[#d4a574] transition-colors">
                    Properties
                  </Link>
                </li>
                <li>
                  <a href="#about" className="text-white/60 hover:text-[#d4a574] transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="tel:+14325591904" className="text-white/60 hover:text-[#d4a574] transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <Link href="/concierge" className="text-white/60 hover:text-[#d4a574] transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-display font-bold text-white mb-4">Contact</h4>
              <ul className="space-y-3 text-white/60">
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#d4a574]" />
                  Midland, TX 79701
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#d4a574]" />
                  (432) 559-1904
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#d4a574]" />
                  <a href="mailto:steven.palma@RAH-midland.com" className="hover:text-[#d4a574] transition-colors">
                    steven.palma@RAH-midland.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 pt-8 border-t border-white/10 text-center text-white/40 text-sm">
            <p>© 2025 Right at Home BnB. All rights reserved. | Steven Palma</p>
            <div className="mt-2 flex items-center justify-center gap-4">
              <Link href="/privacy-policy" className="hover:text-[#d4a574] transition-colors">
                Privacy Policy
              </Link>
              <span>|</span>
              <Link href="/terms-of-service" className="hover:text-[#d4a574] transition-colors">
                Terms of Service
              </Link>
            </div>
            <div className="mt-4">
              <a
                href="https://echo-op.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs opacity-60 hover:opacity-100 transition-opacity"
              >
                Powered by{' '}
                <span className="font-semibold bg-gradient-to-r from-purple-400 via-pink-500 via-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 to-purple-400 bg-[length:200%_auto] animate-[chromatic_3s_linear_infinite] bg-clip-text text-transparent">
                  ECHO PRIME TECHNOLOGIES
                </span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
