'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function PropertiesRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, loading, isOwner, isAdmin } = useAuth();

  const isCreateRoute =
    pathname === '/properties/new' || pathname.startsWith('/properties/new/');
  const canManageProperties = isOwner || isAdmin;

  useEffect(() => {
    if (!isCreateRoute || loading || canManageProperties) return;

    if (!appUser) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    } else {
      router.replace('/properties?error=forbidden');
    }
  }, [appUser, canManageProperties, isCreateRoute, loading, pathname, router]);

  if (isCreateRoute && (loading || !canManageProperties)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <p className="text-[#2D2D2D]/70">
          {loading ? 'Verifying access…' : 'Redirecting…'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        canManageProperties
          ? 'rah-properties-scope rah-can-manage-properties'
          : 'rah-properties-scope'
      }
    >
      <style jsx global>{`
        .rah-properties-scope:not(.rah-can-manage-properties)
          a[href='/properties/new'] {
          display: none !important;
        }
      `}</style>
      {children}
    </div>
  );
}
