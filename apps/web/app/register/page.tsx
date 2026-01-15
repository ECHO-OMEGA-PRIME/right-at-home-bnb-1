'use client';

/**
 * Right at Home BnB - Registration Page
 * Guest and Staff account creation
 * @author ECHO OMEGA PRIME
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Home, User, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, signInWithGoogle, signInWithApple } from '@/lib/auth';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { db } from '@/lib/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

type AccountType = 'guest' | 'cleaner' | 'yard_crew' | 'handyman';

const staffTypes: { value: AccountType; label: string; description: string }[] = [
  { value: 'cleaner', label: 'Cleaner', description: 'Property cleaning & turnover' },
  { value: 'yard_crew', label: 'Yard Crew', description: 'Lawn care & landscaping' },
  { value: 'handyman', label: 'Handyman', description: 'Repairs & maintenance' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accountType, setAccountType] = useState<'guest' | 'staff'>('guest');
  const [staffType, setStaffType] = useState<AccountType>('cleaner');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;
      const role = accountType === 'guest' ? 'guest' : staffType;

      // Update display name
      await updateProfile(user, {
        displayName: `${formData.firstName} ${formData.lastName}`
      });

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: `${formData.firstName} ${formData.lastName}`,
        phone: formData.phone || null,
        role: role,
        staffType: accountType === 'staff' ? staffType : null,
        status: accountType === 'staff' ? 'pending_approval' : 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If guest, also create entry in steven_guests for AI memory
      if (accountType === 'guest') {
        await setDoc(doc(db, 'steven_guests', user.uid), {
          guestId: user.uid,
          guestName: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          phone: formData.phone || null,
          conversations: [],
          preferences: {},
          stays: [],
          tags: ['registered_user'],
          vipStatus: 'standard',
          createdAt: serverTimestamp(),
          lastInteraction: serverTimestamp(),
        });
      }

      toast.success('Account created successfully!');

      if (accountType === 'staff') {
        toast.success('Your account is pending approval by the administrator.');
      }

      router.push('/dashboard');
    } catch (error: any) {
      console.error('Registration error:', error);

      if (error.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Please enter a valid email address');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Please use a stronger password.');
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        toast.success(`Welcome, ${user.displayName || 'Guest'}!`);
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in cancelled');
      } else {
        toast.error('Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    try {
      const user = await signInWithApple();
      if (user) {
        toast.success(`Welcome, ${user.displayName || 'Guest'}!`);
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      toast.error('Apple sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#500000] via-[#722F37] to-[#3D0000] relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-[#C4A777] blur-3xl" />
          <div className="absolute bottom-40 right-10 w-96 h-96 rounded-full bg-[#C4A777] blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-xl bg-[#C4A777] flex items-center justify-center">
                <Home className="w-8 h-8 text-[#500000]" />
              </div>
              <div>
                <h1 className="text-3xl font-['Playfair_Display'] font-semibold">
                  Right at Home
                </h1>
                <p className="text-[#C4A777] text-sm tracking-wider">MIDLAND, TEXAS</p>
              </div>
            </div>

            <h2 className="text-5xl font-['Playfair_Display'] font-bold leading-tight mb-6">
              Join Our<br />
              <span className="text-[#C4A777]">Community</span>
            </h2>

            <p className="text-lg text-white/80 max-w-md leading-relaxed">
              Create your account to book premium short-term rentals,
              access exclusive deals, and enjoy personalized service from Steven AI.
            </p>

            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C4A777]/20 flex items-center justify-center">
                  <span className="text-[#C4A777]">✓</span>
                </div>
                <span className="text-white/80">Instant booking confirmations</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C4A777]/20 flex items-center justify-center">
                  <span className="text-[#C4A777]">✓</span>
                </div>
                <span className="text-white/80">24/7 AI concierge assistance</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C4A777]/20 flex items-center justify-center">
                  <span className="text-[#C4A777]">✓</span>
                </div>
                <span className="text-white/80">Exclusive returning guest discounts</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C4A777] to-transparent" />
      </motion.div>

      {/* Right Panel - Registration Form */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="flex-1 flex items-center justify-center bg-[#F5F5F0] p-8 overflow-y-auto"
      >
        <div className="w-full max-w-md py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#500000] flex items-center justify-center">
              <Home className="w-6 h-6 text-[#C4A777]" />
            </div>
            <div>
              <h1 className="text-2xl font-['Playfair_Display'] font-semibold text-[#500000]">
                Right at Home
              </h1>
            </div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h3 className="text-3xl font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-2">
              Create Account
            </h3>
            <p className="text-[#2D2D2D]/60 mb-6">
              Join us for a premium rental experience
            </p>

            {/* Account Type Selector */}
            <div className="flex gap-2 mb-6 p-1 bg-white rounded-xl shadow-sm">
              {(['guest', 'staff'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                    accountType === type
                      ? 'bg-[#500000] text-white shadow-md'
                      : 'text-[#2D2D2D]/60 hover:text-[#500000]'
                  }`}
                >
                  {type === 'guest' ? 'Guest' : 'Staff'}
                </button>
              ))}
            </div>

            {/* Staff Type Selector */}
            {accountType === 'staff' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#2D2D2D]/80 mb-3">
                  What type of staff are you?
                </label>
                <div className="space-y-2">
                  {staffTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setStaffType(type.value)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        staffType === type.value
                          ? 'border-[#500000] bg-[#500000]/5'
                          : 'border-[#2D2D2D]/10 bg-white hover:border-[#500000]/30'
                      }`}
                    >
                      <div className="font-medium text-[#2D2D2D]">{type.label}</div>
                      <div className="text-sm text-[#2D2D2D]/60">{type.description}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  Staff accounts require approval from the administrator before access is granted.
                </div>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D]/80 mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="John"
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] transition-all placeholder:text-[#2D2D2D]/30"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D]/80 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Smith"
                    className="w-full px-4 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] transition-all placeholder:text-[#2D2D2D]/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2D2D2D]/80 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="w-full pl-12 pr-4 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] transition-all placeholder:text-[#2D2D2D]/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2D2D2D]/80 mb-2">
                  Phone Number <span className="text-[#2D2D2D]/40">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(432) 555-0123"
                    className="w-full pl-12 pr-4 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] transition-all placeholder:text-[#2D2D2D]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2D2D2D]/80 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] transition-all placeholder:text-[#2D2D2D]/30"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2D2D2D]/40 hover:text-[#500000] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2D2D2D]/80 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] transition-all placeholder:text-[#2D2D2D]/30"
                    required
                  />
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1 w-4 h-4 rounded border-[#2D2D2D]/20 text-[#500000] focus:ring-[#500000]/30"
                  required
                />
                <label htmlFor="terms" className="text-sm text-[#2D2D2D]/60">
                  I agree to the{' '}
                  <a href="#" className="text-[#500000] hover:underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-[#500000] hover:underline">Privacy Policy</a>
                </label>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-4 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/25 hover:shadow-xl hover:shadow-[#500000]/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-[#2D2D2D]/10" />
              <span className="text-sm text-[#2D2D2D]/40">or sign up with</span>
              <div className="flex-1 h-px bg-[#2D2D2D]/10" />
            </div>

            {/* Social Registration */}
            <div className="flex gap-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex-1 py-3 px-4 bg-white border border-[#2D2D2D]/10 rounded-xl hover:bg-[#F5F5F0] transition-colors flex items-center justify-center gap-2 text-[#2D2D2D]/80 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button
                onClick={handleAppleSignIn}
                disabled={isLoading}
                className="flex-1 py-3 px-4 bg-white border border-[#2D2D2D]/10 rounded-xl hover:bg-[#F5F5F0] transition-colors flex items-center justify-center gap-2 text-[#2D2D2D]/80 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"/>
                </svg>
                Apple
              </button>
            </div>

            {/* Login Link */}
            <p className="text-center text-sm text-[#2D2D2D]/60 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-[#500000] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
