'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dashboardForRole } from '@/lib/operations-policy';

export default function DashboardRouterPage() {
  const router = useRouter();
  const { appUser, loading } = useAuth();

  useEffect(() => {
    if (loading || !appUser) return;
    const role = dashboardForRole(appUser.role);
    router.replace(role === 'owner' ? '/owner' : role === 'worker' ? '/worker' : '/guest/dashboard');
  }, [appUser, loading, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#F5F5F0]">
      <div className="flex items-center gap-3 text-[#500000]">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="font-medium">Opening your dashboard…</span>
      </div>
    </div>
  );
}
