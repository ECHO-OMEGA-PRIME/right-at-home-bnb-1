'use client';

import { Suspense } from 'react';
import LoginContent from './login-content';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]"><div className="w-8 h-8 border-3 border-[#500000]/30 border-t-[#500000] rounded-full animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
