'use client';

/**
 * Right at Home BnB - App Providers
 * React Query, Toaster, Cross-Platform Sync, Auth, and other global providers
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { createQueryClient } from '@/lib/api';
import { SyncProvider } from '@/context/SyncContext';
import { AuthProvider } from '@/context/AuthContext';

// Default user ID for non-authenticated users
const DEFAULT_USER_ID = 'guest_user';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncProvider userId={DEFAULT_USER_ID}>
          {children}
        </SyncProvider>
      </AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#2D2D2D',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(45, 45, 45, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}
