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
  Phone, Mail, Instagram, Droplets, Flame
} from 'lucide-react';
import { properties as realProperties, PropertyDetails } from '@/lib/property-knowledge';

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
  image: `/properties/${p.id}/main.png`,
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
        <button className="premium-button w-full mt-6 group/btn">
          <span>View Property</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
        </button>
      </div>
    </motion.div>
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

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="#properties" className="premium-button px-8 py-4 text-lg">
              <span>Explore Properties</span>
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border border-white/20 rounded-xl text-white/90
                         hover:bg-white/10 transition-all duration-300 flex items-center gap-2"
            >
              <span>Login</span>
            </Link>
          </motion.div>

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
      <section className="py-24 animate-section">
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

      {/* Testimonials Section */}
      <section className="py-24 animate-section">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[#d4a574] text-sm uppercase tracking-wider">
              Guest Reviews
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-bold mt-4">
              What Our Guests <span className="text-[#d4a574]">Say</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah M.",
                location: "Houston, TX",
                text: "Absolutely stunning property! The attention to detail was incredible. Steven was so responsive and helpful. Will definitely book again!",
                rating: 5
              },
              {
                name: "James R.",
                location: "Dallas, TX",
                text: "Best Airbnb experience I've ever had. Clean, comfortable, and perfectly located for our work trip to the Permian Basin.",
                rating: 5
              },
              {
                name: "Michelle K.",
                location: "Austin, TX",
                text: "We felt right at home from the moment we walked in. The property exceeded all expectations. Highly recommend!",
                rating: 5
              }
            ].map((review, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-glow p-8 rounded-2xl"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(review.rating)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 text-[#d4a574] fill-[#d4a574]" />
                  ))}
                </div>
                <p className="text-white/80 italic">&ldquo;{review.text}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#500000] rounded-full flex items-center justify-center text-white font-bold">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{review.name}</p>
                    <p className="text-sm text-white/50">{review.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
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
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#500000] to-[#8b1538]
                                rounded-xl flex items-center justify-center">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-white">Right at Home</h3>
                  <p className="text-sm text-[#d4a574]">BnB • Midland, TX</p>
                </div>
              </div>
              <p className="mt-4 text-white/60 max-w-md">
                22 premium vacation rentals in the heart of the Permian Basin.
                Texas hospitality at its finest.
              </p>
              <div className="flex items-center gap-4 mt-6">
                <a href="#" className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="#" className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                  <Mail className="w-5 h-5" />
                </a>
                <a href="#" className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                  <Phone className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-display font-bold text-white mb-4">Quick Links</h4>
              <ul className="space-y-3">
                {['Properties', 'About Us', 'Contact', 'FAQ'].map((link) => (
                  <li key={link}>
                    <a href="#" className="text-white/60 hover:text-[#d4a574] transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
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
                  hello@rightathomebnb.com
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 pt-8 border-t border-white/10 text-center text-white/40 text-sm">
            <p>© 2024 Right at Home BnB. All rights reserved. | Steven Palma</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
