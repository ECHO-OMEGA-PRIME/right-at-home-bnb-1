import { redirect } from 'next/navigation';

/**
 * Developer role impersonation was removed from the production application.
 * Use the standard Firebase login flow and real role assignments instead.
 */
export default function DevLoginPage() {
  redirect('/login');
}
