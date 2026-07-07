import { redirect } from 'next/navigation';

/**
 * /listings — legacy URL alias for the property catalog.
 */
export default function ListingsPage() {
  redirect('/properties');
}