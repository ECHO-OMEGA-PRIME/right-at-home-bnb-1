/**
 * Dev Login Layout — Server-side production gate
 * Redirects to /login in production. Only accessible in development.
 */

import { redirect } from 'next/navigation';

export default function DevLoginLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    redirect('/login');
  }

  return <>{children}</>;
}
