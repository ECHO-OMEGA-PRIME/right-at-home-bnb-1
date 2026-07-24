import type { ReactNode } from 'react';
import { requirePageRole } from '@/lib/page-auth';

export default async function NewPropertyLayout({ children }: { children: ReactNode }) {
  await requirePageRole('owner');
  return children;
}
