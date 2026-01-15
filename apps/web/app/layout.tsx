import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter, Outfit } from 'next/font/google';
import '../src/styles/globals.css';
import { Providers } from './providers';
import StevenAI from '@/components/StevenAI';

// Premium Display Font - Elegant headers
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

// Modern Body Font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Clean Modern Font
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#500000',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://rightathomebnb.com'),
  title: {
    default: 'Right at Home BnB | Premium Vacation Rentals | Midland, TX',
    template: '%s | Right at Home BnB',
  },
  description: 'Experience Texas hospitality at its finest. 22 premium short-term rental properties in Midland, Texas. Curated by Steven Palma for business travelers and families.',
  keywords: [
    'Midland TX vacation rentals',
    'short-term rental Midland',
    'Airbnb Midland Texas',
    'VRBO Midland',
    'Permian Basin lodging',
    'Steven Palma rentals',
    'Texas hospitality',
    'business travel Midland',
    'family vacation Texas',
  ],
  authors: [{ name: 'Steven Palma' }],
  creator: 'Right at Home BnB',
  publisher: 'Steven Palma',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://rightathomebnb.com',
    siteName: 'Right at Home BnB',
    title: 'Right at Home BnB | Premium Vacation Rentals | Midland, TX',
    description: 'Experience Texas hospitality at its finest. 22 premium properties in the Permian Basin.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Right at Home BnB - Premium Vacation Rentals in Midland, TX',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Right at Home BnB | Midland, TX',
    description: '22 premium vacation rentals in the heart of the Permian Basin.',
    images: ['/og-image.jpg'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://rightathomebnb.com',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Premium font loading */}
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans bg-[#0a0505] text-white selection:bg-[#500000]/50 selection:text-white">
        <Providers>
          {/* Skip to content for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
                       focus:z-50 focus:px-4 focus:py-2 focus:bg-[#500000] focus:text-white
                       focus:rounded-lg focus:outline-none"
          >
            Skip to content
          </a>

          <main id="main-content">
            {children}
          </main>

          {/* Floating Steven AI Voice Assistant */}
          <StevenAI mode="widget" />
        </Providers>
      </body>
    </html>
  );
}
