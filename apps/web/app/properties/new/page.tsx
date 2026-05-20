'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Home, MapPin, DollarSign, CheckSquare, ShieldCheck, Wifi, Link2,
  Phone, Camera, FileText, ChevronRight, ChevronLeft, Check, Loader2,
  Building2, Bed, Bath, Users, Ruler, Calendar, Clock, Cigarette,
  PawPrint, Music, PartyPopper, Lock, Car, KeyRound, Globe,
  AlertCircle, Sparkles, X, Plus, Trash2, ArrowLeft, Star,
  Waves, Flame, Tv, UtensilsCrossed, Fence, Zap, Eye, Dumbbell,
  Laptop, Crown, TreePine, Baby,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface FormData {
  // Basic Info
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  description: string;
  // Details
  bedrooms: string;
  bathrooms: string;
  maxGuests: string;
  squareFeet: string;
  yearBuilt: string;
  lotSize: string;
  // Pricing
  nightlyRate: string;
  weekendRate: string;
  weeklyDiscount: string;
  monthlyDiscount: string;
  cleaningFee: string;
  petFee: string;
  extraGuestFee: string;
  securityDeposit: string;
  // Amenities
  amenities: Record<string, boolean>;
  // House Rules
  maxOccupancy: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  partiesAllowed: boolean;
  checkInTime: string;
  checkOutTime: string;
  customRules: string;
  // WiFi & Access
  wifiNetwork: string;
  wifiPassword: string;
  lockType: string;
  lockCode: string;
  parkingInfo: string;
  gateCode: string;
  checkInNotes: string;
  // Listing IDs
  vrboId: string;
  airbnbId: string;
  bookingComId: string;
  directBookingUrl: string;
  // Contact / Emergency
  propertyContact: string;
  nearestHospital: string;
  nearestUrgentCare: string;
  emergencyNotes: string;
  // Photos
  photoUrls: string[];
  photoCaptions: string[];
  // Notes
  internalNotes: string;
}

interface StepDef {
  id: string;
  label: string;
  icon: React.ElementType;
  shortLabel: string;
}

// ─── Steps Config ───────────────────────────────────────────────────────────
const STEPS: StepDef[] = [
  { id: 'basic',     label: 'Basic Information',     icon: Home,        shortLabel: 'Basic' },
  { id: 'details',   label: 'Property Details',      icon: Building2,   shortLabel: 'Details' },
  { id: 'pricing',   label: 'Pricing & Fees',        icon: DollarSign,  shortLabel: 'Pricing' },
  { id: 'amenities', label: 'Amenities',             icon: Sparkles,    shortLabel: 'Amenities' },
  { id: 'rules',     label: 'House Rules',           icon: ShieldCheck, shortLabel: 'Rules' },
  { id: 'access',    label: 'WiFi & Access',         icon: Wifi,        shortLabel: 'Access' },
  { id: 'listings',  label: 'Listing IDs',           icon: Link2,       shortLabel: 'Listings' },
  { id: 'emergency', label: 'Contact & Emergency',   icon: Phone,       shortLabel: 'Emergency' },
  { id: 'photos',    label: 'Photos',                icon: Camera,      shortLabel: 'Photos' },
  { id: 'notes',     label: 'Notes & Review',        icon: FileText,    shortLabel: 'Review' },
];

// ─── Amenity Definitions ────────────────────────────────────────────────────
const AMENITY_OPTIONS = [
  { key: 'pool',            label: 'Pool',              icon: Waves },
  { key: 'hotTub',          label: 'Hot Tub / Jacuzzi', icon: Flame },
  { key: 'billiards',       label: 'Billiards / Pool Table', icon: Star },
  { key: 'wifi',            label: 'WiFi',              icon: Wifi },
  { key: 'washerDryer',     label: 'Washer & Dryer',    icon: Sparkles },
  { key: 'garage',          label: 'Garage',            icon: Car },
  { key: 'coveredPatio',    label: 'Covered Patio',     icon: Home },
  { key: 'firePit',         label: 'Fire Pit',          icon: Flame },
  { key: 'playground',      label: 'Playground',        icon: Baby },
  { key: 'smartTv',         label: 'Smart TV',          icon: Tv },
  { key: 'kitchen',         label: 'Full Kitchen',      icon: UtensilsCrossed },
  { key: 'bbqGrill',        label: 'BBQ Grill',         icon: Flame },
  { key: 'fencedYard',      label: 'Fenced Yard',       icon: Fence },
  { key: 'evCharger',       label: 'EV Charger',        icon: Zap },
  { key: 'securityCameras', label: 'Security Cameras',  icon: Eye },
  { key: 'smartLocks',      label: 'Smart Locks',       icon: Lock },
  { key: 'kingBed',         label: 'King Bed',          icon: Crown },
  { key: 'workspace',       label: 'Dedicated Workspace', icon: Laptop },
];

const PROPERTY_TYPES = [
  { value: 'HOUSE',     label: 'House' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'CONDO',     label: 'Condo' },
  { value: 'STUDIO',    label: 'Studio' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'CABIN',     label: 'Cabin' },
  { value: 'DUPLEX',    label: 'Duplex' },
];

const LOCK_TYPES = [
  { value: 'smart',    label: 'Smart Lock (App-controlled)' },
  { value: 'keypad',   label: 'Keypad / Code Lock' },
  { value: 'physical', label: 'Physical Key' },
  { value: 'lockbox',  label: 'Lockbox' },
  { value: 'combo',    label: 'Combination Lock' },
];

// ─── Initial State ──────────────────────────────────────────────────────────
function getInitialFormData(): FormData {
  return {
    name: '', address: '', city: 'Midland', state: 'TX', zipCode: '',
    propertyType: 'HOUSE', description: '',
    bedrooms: '', bathrooms: '', maxGuests: '', squareFeet: '',
    yearBuilt: '', lotSize: '',
    nightlyRate: '', weekendRate: '', weeklyDiscount: '', monthlyDiscount: '',
    cleaningFee: '', petFee: '', extraGuestFee: '', securityDeposit: '',
    amenities: {},
    maxOccupancy: '', quietHoursStart: '22:00', quietHoursEnd: '08:00',
    smokingAllowed: false, petsAllowed: false, partiesAllowed: false,
    checkInTime: '15:00', checkOutTime: '11:00', customRules: '',
    wifiNetwork: '', wifiPassword: '', lockType: 'keypad', lockCode: '',
    parkingInfo: '', gateCode: '', checkInNotes: '',
    vrboId: '', airbnbId: '', bookingComId: '', directBookingUrl: '',
    propertyContact: '', nearestHospital: '', nearestUrgentCare: '',
    emergencyNotes: '',
    photoUrls: ['', '', '', ''],
    photoCaptions: ['', '', '', ''],
    internalNotes: '',
  };
}

// ─── Reusable Components ────────────────────────────────────────────────────

function InputField({ label, value, onChange, placeholder, type = 'text', required = false, prefix, suffix, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; required?: boolean; prefix?: string; suffix?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-400 text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 text-white
            placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C4A777]/50 focus:border-[#C4A777]
            transition-all duration-200 ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 text-gray-400 text-sm pointer-events-none">{suffix}</span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, rows = 4, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 text-white
          placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C4A777]/50 focus:border-[#C4A777]
          transition-all duration-200 resize-none"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 text-white
          focus:outline-none focus:ring-2 focus:ring-[#C4A777]/50 focus:border-[#C4A777]
          transition-all duration-200 appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange, icon: Icon, description }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
  icon?: React.ElementType; description?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200
        ${checked
          ? 'bg-[#500000]/20 border-[#C4A777]/40'
          : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
        }`}
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`w-5 h-5 ${checked ? 'text-[#C4A777]' : 'text-gray-500'}`} />}
        <div>
          <span className={`text-sm font-medium ${checked ? 'text-white' : 'text-gray-300'}`}>{label}</span>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors duration-200
        ${checked ? 'bg-[#C4A777]' : 'bg-gray-600'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
          ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-[#500000]/30 rounded-xl border border-[#C4A777]/20">
          <Icon className="w-6 h-6 text-[#C4A777]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white font-[family-name:var(--font-playfair)]">{title}</h2>
          <p className="text-sm text-gray-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function NewPropertyPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(getInitialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; property?: any; error?: string } | null>(null);

  // Update a single field
  const setField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Toggle amenity
  const toggleAmenity = useCallback((key: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: { ...prev.amenities, [key]: !prev.amenities[key] },
    }));
  }, []);

  // Update photo URL at index
  const setPhotoUrl = useCallback((idx: number, url: string) => {
    setFormData((prev) => {
      const urls = [...prev.photoUrls];
      urls[idx] = url;
      return { ...prev, photoUrls: urls };
    });
  }, []);

  const setPhotoCaption = useCallback((idx: number, caption: string) => {
    setFormData((prev) => {
      const captions = [...prev.photoCaptions];
      captions[idx] = caption;
      return { ...prev, photoCaptions: captions };
    });
  }, []);

  const addPhotoSlot = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      photoUrls: [...prev.photoUrls, ''],
      photoCaptions: [...prev.photoCaptions, ''],
    }));
  }, []);

  const removePhotoSlot = useCallback((idx: number) => {
    setFormData((prev) => ({
      ...prev,
      photoUrls: prev.photoUrls.filter((_, i) => i !== idx),
      photoCaptions: prev.photoCaptions.filter((_, i) => i !== idx),
    }));
  }, []);

  // Validate current step
  const validateStep = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    const step = STEPS[currentStep].id;

    if (step === 'basic') {
      if (!formData.name.trim()) errs.name = 'Property name is required';
      if (!formData.address.trim()) errs.address = 'Address is required';
    }
    if (step === 'details') {
      if (!formData.bedrooms) errs.bedrooms = 'Number of bedrooms is required';
      if (!formData.bathrooms) errs.bathrooms = 'Number of bathrooms is required';
      if (!formData.maxGuests) errs.maxGuests = 'Max guests is required';
    }
    if (step === 'pricing') {
      if (!formData.nightlyRate) errs.nightlyRate = 'Nightly rate is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [currentStep, formData]);

  // Navigate
  const goNext = useCallback(() => {
    if (validateStep()) {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [validateStep]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goToStep = useCallback((idx: number) => {
    // Allow going back freely, require validation to go forward
    if (idx < currentStep) {
      setCurrentStep(idx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (idx === currentStep + 1) {
      goNext();
    }
  }, [currentStep, goNext]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const resp = await fetch('/api/properties/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await resp.json();

      if (resp.ok) {
        setSubmitResult({ success: true, property: data.property });
      } else {
        setSubmitResult({ success: false, error: data.error || 'Unknown error occurred' });
      }
    } catch (err: any) {
      setSubmitResult({ success: false, error: err.message || 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateStep]);

  // ─── Success Screen ─────────────────────────────────────────────────────
  if (submitResult?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-[#0a0505] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-lg w-full bg-gray-900/80 border border-[#C4A777]/30 rounded-2xl p-8 text-center backdrop-blur-sm"
        >
          <div className="w-20 h-20 mx-auto mb-6 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 font-[family-name:var(--font-playfair)]">
            Property Created!
          </h1>
          <p className="text-gray-400 mb-2">
            <span className="text-[#C4A777] font-semibold">{submitResult.property?.name}</span> has been
            added to your portfolio.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            {submitResult.property?.address}, {submitResult.property?.city}, {submitResult.property?.state}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/properties"
              className="px-6 py-3 bg-[#500000] hover:bg-[#600000] text-white rounded-xl font-medium
                transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              View All Properties
            </Link>
            <button
              onClick={() => {
                setFormData(getInitialFormData());
                setCurrentStep(0);
                setSubmitResult(null);
              }}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium
                transition-colors duration-200 flex items-center justify-center gap-2 border border-gray-700"
            >
              <Plus className="w-4 h-4" />
              Add Another Property
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Step Content Renderers ─────────────────────────────────────────────

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <SectionHeader icon={Home} title="Basic Information" subtitle="Tell us about this property" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <InputField
            label="Property Name" value={formData.name}
            onChange={(v) => setField('name', v)}
            placeholder='e.g. "The Oasis on Garfield" or "Palma Place #3"'
            required
          />
          {errors.name && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
        </div>
        <div className="md:col-span-2">
          <InputField
            label="Street Address" value={formData.address}
            onChange={(v) => setField('address', v)}
            placeholder="1234 W. Wall Street"
            required
          />
          {errors.address && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.address}</p>}
        </div>
        <InputField
          label="City" value={formData.city}
          onChange={(v) => setField('city', v)}
          placeholder="Midland"
        />
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="State" value={formData.state}
            onChange={(v) => setField('state', v)}
            placeholder="TX"
          />
          <InputField
            label="ZIP Code" value={formData.zipCode}
            onChange={(v) => setField('zipCode', v)}
            placeholder="79701"
          />
        </div>
        <SelectField
          label="Property Type" value={formData.propertyType}
          onChange={(v) => setField('propertyType', v)}
          options={PROPERTY_TYPES}
        />
      </div>
      <TextAreaField
        label="Description" value={formData.description}
        onChange={(v) => setField('description', v)}
        placeholder="Describe this property for guests... What makes it special?"
        rows={4}
        hint="This description can be used for listings and guest communications"
      />
    </div>
  );

  const renderDetails = () => (
    <div className="space-y-6">
      <SectionHeader icon={Building2} title="Property Details" subtitle="Size, capacity, and specifications" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <div>
          <InputField
            label="Bedrooms" value={formData.bedrooms}
            onChange={(v) => setField('bedrooms', v)}
            placeholder="3" type="number" required
          />
          {errors.bedrooms && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.bedrooms}</p>}
        </div>
        <div>
          <InputField
            label="Bathrooms" value={formData.bathrooms}
            onChange={(v) => setField('bathrooms', v)}
            placeholder="2" type="number" required
          />
          {errors.bathrooms && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.bathrooms}</p>}
        </div>
        <div>
          <InputField
            label="Max Guests" value={formData.maxGuests}
            onChange={(v) => setField('maxGuests', v)}
            placeholder="8" type="number" required
          />
          {errors.maxGuests && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.maxGuests}</p>}
        </div>
        <InputField
          label="Square Feet" value={formData.squareFeet}
          onChange={(v) => setField('squareFeet', v)}
          placeholder="1,800" type="number"
          suffix="sq ft"
        />
        <InputField
          label="Year Built" value={formData.yearBuilt}
          onChange={(v) => setField('yearBuilt', v)}
          placeholder="2005" type="number"
        />
        <InputField
          label="Lot Size" value={formData.lotSize}
          onChange={(v) => setField('lotSize', v)}
          placeholder="0.25 acres"
        />
      </div>
    </div>
  );

  const renderPricing = () => (
    <div className="space-y-6">
      <SectionHeader icon={DollarSign} title="Pricing & Fees" subtitle="Set your rates and additional charges" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <InputField
            label="Nightly Rate" value={formData.nightlyRate}
            onChange={(v) => setField('nightlyRate', v)}
            placeholder="150" type="number" required prefix="$"
          />
          {errors.nightlyRate && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.nightlyRate}</p>}
        </div>
        <InputField
          label="Weekend Rate" value={formData.weekendRate}
          onChange={(v) => setField('weekendRate', v)}
          placeholder="175" type="number" prefix="$"
          hint="Fri-Sat rate (leave blank to use nightly rate)"
        />
        <InputField
          label="Weekly Discount" value={formData.weeklyDiscount}
          onChange={(v) => setField('weeklyDiscount', v)}
          placeholder="10" type="number" suffix="%"
          hint="Discount for 7+ night stays"
        />
        <InputField
          label="Monthly Discount" value={formData.monthlyDiscount}
          onChange={(v) => setField('monthlyDiscount', v)}
          placeholder="20" type="number" suffix="%"
          hint="Discount for 28+ night stays"
        />
      </div>
      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Additional Fees</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <InputField
            label="Cleaning Fee" value={formData.cleaningFee}
            onChange={(v) => setField('cleaningFee', v)}
            placeholder="85" type="number" prefix="$"
          />
          <InputField
            label="Pet Fee" value={formData.petFee}
            onChange={(v) => setField('petFee', v)}
            placeholder="50" type="number" prefix="$"
            hint="Per stay, if pets are allowed"
          />
          <InputField
            label="Extra Guest Fee" value={formData.extraGuestFee}
            onChange={(v) => setField('extraGuestFee', v)}
            placeholder="25" type="number" prefix="$"
            hint="Per night per additional guest beyond base occupancy"
          />
          <InputField
            label="Security Deposit" value={formData.securityDeposit}
            onChange={(v) => setField('securityDeposit', v)}
            placeholder="200" type="number" prefix="$"
          />
        </div>
      </div>
    </div>
  );

  const renderAmenities = () => (
    <div className="space-y-6">
      <SectionHeader icon={Sparkles} title="Amenities" subtitle="Select all amenities available at this property" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {AMENITY_OPTIONS.map(({ key, label, icon: Icon }) => {
          const checked = !!formData.amenities[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleAmenity(key)}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200
                ${checked
                  ? 'bg-[#500000]/25 border-[#C4A777]/50 shadow-lg shadow-[#C4A777]/5'
                  : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/60'
                }`}
            >
              <div className={`p-2 rounded-lg ${checked ? 'bg-[#C4A777]/20' : 'bg-gray-700/50'}`}>
                <Icon className={`w-4 h-4 ${checked ? 'text-[#C4A777]' : 'text-gray-400'}`} />
              </div>
              <span className={`text-sm font-medium ${checked ? 'text-white' : 'text-gray-400'}`}>
                {label}
              </span>
              {checked && (
                <Check className="w-4 h-4 text-[#C4A777] ml-auto" />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        {Object.values(formData.amenities).filter(Boolean).length} amenities selected
      </p>
    </div>
  );

  const renderHouseRules = () => (
    <div className="space-y-6">
      <SectionHeader icon={ShieldCheck} title="House Rules" subtitle="Set expectations for your guests" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <InputField
          label="Max Occupancy" value={formData.maxOccupancy}
          onChange={(v) => setField('maxOccupancy', v)}
          placeholder="10"
          hint="Total people allowed including guests of guests"
        />
        <div /> {/* spacer */}
        <InputField
          label="Quiet Hours Start" value={formData.quietHoursStart}
          onChange={(v) => setField('quietHoursStart', v)}
          type="time"
        />
        <InputField
          label="Quiet Hours End" value={formData.quietHoursEnd}
          onChange={(v) => setField('quietHoursEnd', v)}
          type="time"
        />
        <InputField
          label="Check-in Time" value={formData.checkInTime}
          onChange={(v) => setField('checkInTime', v)}
          type="time"
        />
        <InputField
          label="Check-out Time" value={formData.checkOutTime}
          onChange={(v) => setField('checkOutTime', v)}
          type="time"
        />
      </div>
      <div className="space-y-3 mt-6">
        <ToggleSwitch
          label="Smoking Allowed" checked={formData.smokingAllowed}
          onChange={(v) => setField('smokingAllowed', v)}
          icon={Cigarette}
          description="Outdoor smoking areas only? Specify in custom rules below"
        />
        <ToggleSwitch
          label="Pets Allowed" checked={formData.petsAllowed}
          onChange={(v) => setField('petsAllowed', v)}
          icon={PawPrint}
          description="Remember to set a pet fee in the Pricing section"
        />
        <ToggleSwitch
          label="Parties / Events Allowed" checked={formData.partiesAllowed}
          onChange={(v) => setField('partiesAllowed', v)}
          icon={PartyPopper}
          description="Allow gatherings beyond normal guest count"
        />
      </div>
      <TextAreaField
        label="Custom Rules" value={formData.customRules}
        onChange={(v) => setField('customRules', v)}
        placeholder="Any additional rules or special instructions for guests..."
        rows={4}
        hint="These rules will be shared with guests before check-in"
      />
    </div>
  );

  const renderAccess = () => (
    <div className="space-y-6">
      <SectionHeader icon={Wifi} title="WiFi & Access Info" subtitle="Guest access details (stored securely)" />
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-medium">Sensitive information is encrypted and only shared with confirmed guests</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <InputField
          label="WiFi Network Name" value={formData.wifiNetwork}
          onChange={(v) => setField('wifiNetwork', v)}
          placeholder="RAH_Guest_5G"
        />
        <InputField
          label="WiFi Password" value={formData.wifiPassword}
          onChange={(v) => setField('wifiPassword', v)}
          placeholder="WelcomeHome2024"
        />
      </div>
      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Lock & Entry</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SelectField
            label="Lock Type" value={formData.lockType}
            onChange={(v) => setField('lockType', v)}
            options={LOCK_TYPES}
          />
          <InputField
            label="Lock Code / Key Info" value={formData.lockCode}
            onChange={(v) => setField('lockCode', v)}
            placeholder="1234#"
            hint="For keypad: include # if needed"
          />
          <InputField
            label="Gate Code" value={formData.gateCode}
            onChange={(v) => setField('gateCode', v)}
            placeholder="#5678"
            hint="If the property has a gated entrance"
          />
          <InputField
            label="Parking Instructions" value={formData.parkingInfo}
            onChange={(v) => setField('parkingInfo', v)}
            placeholder="Driveway fits 2 cars. Street parking available."
          />
        </div>
      </div>
      <TextAreaField
        label="Additional Check-in Instructions" value={formData.checkInNotes}
        onChange={(v) => setField('checkInNotes', v)}
        placeholder="Special directions, gate instructions, where to find keys..."
        rows={3}
      />
    </div>
  );

  const renderListings = () => (
    <div className="space-y-6">
      <SectionHeader icon={Link2} title="Listing IDs" subtitle="Connect your external booking platforms" />
      <p className="text-sm text-gray-400 mb-4">
        Link this property to your active listings for synced calendars and messaging.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <InputField
          label="VRBO Listing ID" value={formData.vrboId}
          onChange={(v) => setField('vrboId', v)}
          placeholder="12345678"
          hint="Found in your VRBO dashboard URL"
        />
        <InputField
          label="Airbnb Listing ID" value={formData.airbnbId}
          onChange={(v) => setField('airbnbId', v)}
          placeholder="12345678"
          hint="Found in your Airbnb listing URL"
        />
        <InputField
          label="Booking.com ID" value={formData.bookingComId}
          onChange={(v) => setField('bookingComId', v)}
          placeholder="hotel/us/property-name"
          hint="Your Booking.com property identifier"
        />
        <InputField
          label="Direct Booking URL" value={formData.directBookingUrl}
          onChange={(v) => setField('directBookingUrl', v)}
          placeholder="https://rah-midland.com/book/property-name"
          hint="Your own website booking link"
        />
      </div>
    </div>
  );

  const renderEmergency = () => (
    <div className="space-y-6">
      <SectionHeader icon={Phone} title="Contact & Emergency" subtitle="Important contacts for this property" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <InputField
          label="Property-Specific Contact" value={formData.propertyContact}
          onChange={(v) => setField('propertyContact', v)}
          placeholder="432-555-0199 (on-site manager)"
          hint="Local contact for this property if different from main office"
        />
        <div /> {/* spacer */}
        <InputField
          label="Nearest Hospital" value={formData.nearestHospital}
          onChange={(v) => setField('nearestHospital', v)}
          placeholder="Midland Memorial Hospital - 2200 W Illinois Ave (4.2 mi)"
        />
        <InputField
          label="Nearest Urgent Care" value={formData.nearestUrgentCare}
          onChange={(v) => setField('nearestUrgentCare', v)}
          placeholder="NextCare Urgent Care - 4519 N Midkiff Rd (2.1 mi)"
        />
      </div>
      <TextAreaField
        label="Emergency Notes" value={formData.emergencyNotes}
        onChange={(v) => setField('emergencyNotes', v)}
        placeholder="Water shutoff valve location, gas shutoff, circuit breaker location, neighbor contact..."
        rows={4}
        hint="Critical information for maintenance emergencies"
      />
    </div>
  );

  const renderPhotos = () => (
    <div className="space-y-6">
      <SectionHeader icon={Camera} title="Photos" subtitle="Add photo URLs for the property listing" />
      <p className="text-sm text-gray-400 mb-4">
        Add direct links to property photos. The first photo will be used as the primary/cover image.
        File upload support is coming soon.
      </p>
      <div className="space-y-4">
        {formData.photoUrls.map((url, idx) => (
          <div key={idx} className="flex items-start gap-3 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center text-sm text-gray-400 font-medium">
              {idx === 0 ? <Star className="w-4 h-4 text-[#C4A777]" /> : idx + 1}
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setPhotoUrl(idx, e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C4A777]/50 focus:border-[#C4A777]"
              />
              <input
                type="text"
                value={formData.photoCaptions[idx] || ''}
                onChange={(e) => setPhotoCaption(idx, e.target.value)}
                placeholder="Caption (optional)"
                className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C4A777]/50 focus:border-[#C4A777]"
              />
            </div>
            {formData.photoUrls.length > 1 && (
              <button
                type="button"
                onClick={() => removePhotoSlot(idx)}
                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {formData.photoUrls.length < 10 && (
        <button
          type="button"
          onClick={addPhotoSlot}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl
            border border-gray-700 border-dashed transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Photo ({formData.photoUrls.length}/10)
        </button>
      )}
    </div>
  );

  const renderNotes = () => {
    const selectedAmenities = AMENITY_OPTIONS.filter((a) => formData.amenities[a.key]);
    return (
      <div className="space-y-6">
        <SectionHeader icon={FileText} title="Notes & Review" subtitle="Final notes and review before submitting" />

        <TextAreaField
          label="Internal Notes" value={formData.internalNotes}
          onChange={(v) => setField('internalNotes', v)}
          placeholder="Anything to remember about this property... appliance quirks, neighbor info, maintenance schedule..."
          rows={5}
          hint="These notes are only visible to you and your team, never shared with guests"
        />

        {/* Summary */}
        <div className="border-t border-gray-800 pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Property Summary</h3>
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 divide-y divide-gray-700/50">
            <SummaryRow label="Name" value={formData.name || '(not set)'} />
            <SummaryRow label="Address" value={`${formData.address || '(not set)'}, ${formData.city}, ${formData.state} ${formData.zipCode}`} />
            <SummaryRow label="Type" value={PROPERTY_TYPES.find((t) => t.value === formData.propertyType)?.label || formData.propertyType} />
            <SummaryRow label="Beds / Baths / Guests" value={`${formData.bedrooms || '?'} beds, ${formData.bathrooms || '?'} baths, ${formData.maxGuests || '?'} guests`} />
            <SummaryRow label="Nightly Rate" value={formData.nightlyRate ? `$${formData.nightlyRate}` : '(not set)'} />
            {formData.cleaningFee && <SummaryRow label="Cleaning Fee" value={`$${formData.cleaningFee}`} />}
            <SummaryRow label="Amenities" value={selectedAmenities.length > 0 ? selectedAmenities.map((a) => a.label).join(', ') : 'None selected'} />
            <SummaryRow label="Check-in / Check-out" value={`${formData.checkInTime} / ${formData.checkOutTime}`} />
            {formData.vrboId && <SummaryRow label="VRBO ID" value={formData.vrboId} />}
            {formData.airbnbId && <SummaryRow label="Airbnb ID" value={formData.airbnbId} />}
            <SummaryRow label="Photos" value={`${formData.photoUrls.filter((u) => u.trim()).length} photo(s) added`} />
          </div>
        </div>

        {submitResult?.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{submitResult.error}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center px-4 py-3 gap-1 sm:gap-4">
        <span className="text-sm text-gray-400 sm:w-40 flex-shrink-0">{label}</span>
        <span className="text-sm text-white">{value}</span>
      </div>
    );
  }

  // ─── Step Router ────────────────────────────────────────────────────────
  const stepRenderers: Record<string, () => JSX.Element> = {
    basic: renderBasicInfo,
    details: renderDetails,
    pricing: renderPricing,
    amenities: renderAmenities,
    rules: renderHouseRules,
    access: renderAccess,
    listings: renderListings,
    emergency: renderEmergency,
    photos: renderPhotos,
    notes: renderNotes,
  };

  const isLastStep = currentStep === STEPS.length - 1;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-[#0a0505]">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/properties" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Back to Properties</span>
          </Link>
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-[#C4A777]" />
            <span className="text-sm font-medium text-white">New Property</span>
          </div>
          <span className="text-xs text-gray-500">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="sticky top-[53px] z-40 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto px-4">
          {/* Desktop Steps */}
          <div className="hidden md:flex items-center justify-between py-3 overflow-x-auto">
            {STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(idx)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                    ${isCurrent
                      ? 'text-[#C4A777] bg-[#C4A777]/10'
                      : isCompleted
                        ? 'text-emerald-400 hover:text-emerald-300 cursor-pointer'
                        : 'text-gray-500 cursor-default'
                    }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border
                    ${isCurrent
                      ? 'border-[#C4A777] bg-[#C4A777]/20 text-[#C4A777]'
                      : isCompleted
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-gray-700 text-gray-600'
                    }`}>
                    {isCompleted ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <span className="hidden lg:inline">{step.shortLabel}</span>
                </button>
              );
            })}
          </div>
          {/* Mobile Progress Bar */}
          <div className="md:hidden py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#C4A777] font-medium">{STEPS[currentStep].label}</span>
              <span className="text-xs text-gray-500">{currentStep + 1}/{STEPS.length}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#500000] to-[#C4A777] rounded-full"
                initial={false}
                animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={STEPS[currentStep].id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {stepRenderers[STEPS[currentStep].id]()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-md border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all
              ${currentStep === 0
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700'
              }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#500000] to-[#6a0000]
                hover:from-[#600000] hover:to-[#7a0000] text-white rounded-xl font-semibold text-sm
                shadow-lg shadow-[#500000]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                border border-[#C4A777]/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Property...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Submit Property
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-2 px-6 py-3 bg-[#500000] hover:bg-[#600000] text-white
                rounded-xl font-medium text-sm transition-all shadow-lg shadow-[#500000]/20
                border border-[#C4A777]/20"
            >
              Save & Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
