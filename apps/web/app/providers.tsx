'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { createQueryClient } from '@/lib/api';
import { AuthProvider } from '@/context/AuthContext';

/*
 * SyncProvider is deliberately NOT mounted.
 *
 * It wrapped every page, and on every page load it initialised Firebase,
 * registered a device document, wrote presence heartbeats and opened an
 * `onSnapshot` listener on `sync_events`. All of that fed a context value that
 * NOTHING in this application reads: `useSync()` has no consumer outside
 * SyncContext itself, every `useSynced*` hook is called only inside that file,
 * and `app/bookings/page.tsx` defines its own local `useSyncStatus` rather than
 * importing the context's. The only in-repo reader of the collections it wrote
 * was the provider itself.
 *
 * So this was an open realtime connection to a Google project -- on every page,
 * for every signed-in user -- delivering data to no one, against a Firestore
 * whose billing accounts are closed and which answers 429. Unmounting it is the
 * single largest remaining removal of Firebase from the browser.
 *
 * The code is kept, not deleted: if a second client (a mobile app) is ever
 * built and genuinely needs cross-device presence, re-mounting is one line --
 * but it should then be rebuilt on our own transport rather than Firestore.
 */

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
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
