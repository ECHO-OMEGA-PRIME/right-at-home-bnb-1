import { redirect } from 'next/navigation';

/**
 * /booking — canonical booking entry point.
 * Sub-routes (/booking/success, /booking/confirm) remain unchanged.
 */
export default function BookingIndexPage() {
  redirect('/book');
}