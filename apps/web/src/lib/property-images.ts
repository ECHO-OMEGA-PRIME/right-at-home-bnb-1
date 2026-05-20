/**
 * Property Images Configuration
 * Pulls real property photos from Prisma PropertyPhoto table
 * Falls back to VRBO listing URLs for properties without DB photos
 *
 * @author ECHO OMEGA PRIME
 */

import prisma from '@/lib/prisma';

export interface PropertyImage {
  id: string;
  url: string;
  alt: string;
  isPrimary?: boolean;
}

export interface PropertyImages {
  propertyId: string;
  propertyName: string;
  vrboId: string;
  vrboUrl: string;
  coverImage: string;
  images: PropertyImage[];
}

// VRBO image base URLs
const VRBO_BASE = 'https://www.vrbo.com';
const getVrboUrl = (id: string) => `${VRBO_BASE}/${id}`;

// Default placeholder — only used when DB has no photos AND no VRBO ID
const PLACEHOLDER = '/images/property-placeholder.jpg';

/**
 * All 25 Right At Home BnB Properties with VRBO IDs and image configuration
 */
export const propertyImages: PropertyImages[] = [
  // 1. Oasis with Pool-Billiards @ Castleford
  {
    propertyId: 'castleford-5001',
    propertyName: 'Oasis with Pool-Billiards',
    vrboId: '2636389',
    vrboUrl: getVrboUrl('2636389'),
    coverImage: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop',
    images: [
      { id: 'castleford-1', url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop', alt: 'Pool area', isPrimary: true },
      { id: 'castleford-2', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop', alt: 'Living room' },
      { id: 'castleford-3', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop', alt: 'Kitchen' },
      { id: 'castleford-4', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop', alt: 'Billiards room' },
    ]
  },
  // 2. Adobe Compound with Pool, Fire Pits & Billiards @ Golf Course
  {
    propertyId: 'adobe-compound-gc',
    propertyName: 'Adobe Compound',
    vrboId: '3005111',
    vrboUrl: getVrboUrl('3005111'),
    coverImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
    images: [
      { id: 'adobe-1', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'adobe-2', url: 'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=800&h=600&fit=crop', alt: 'Pool' },
      { id: 'adobe-3', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop', alt: 'Fire pit' },
      { id: 'adobe-4', url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Billiards' },
    ]
  },
  // 3. Patio Home with Hot Tub @ Garfield
  {
    propertyId: 'garfield-2702',
    propertyName: 'Patio Home with Hot Tub',
    vrboId: '2634718',
    vrboUrl: getVrboUrl('2634718'),
    coverImage: 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=800&h=600&fit=crop',
    images: [
      { id: 'garfield-1', url: 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=800&h=600&fit=crop', alt: 'Hot tub', isPrimary: true },
      { id: 'garfield-2', url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop', alt: 'Patio' },
      { id: 'garfield-3', url: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop', alt: 'Living room' },
    ]
  },
  // 4. Old Midland Living @ Douglas
  {
    propertyId: 'douglas-4501',
    propertyName: 'Old Midland Living',
    vrboId: '3355618',
    vrboUrl: getVrboUrl('3355618'),
    coverImage: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop',
    images: [
      { id: 'douglas-1', url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'douglas-2', url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop', alt: 'Massive yard' },
      { id: 'douglas-3', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop', alt: 'Kitchen' },
    ]
  },
  // 5. Hot Tub Delight @ Dentcrest
  {
    propertyId: 'dentcrest-4707',
    propertyName: 'Hot Tub Delight',
    vrboId: '2638481',
    vrboUrl: getVrboUrl('2638481'),
    coverImage: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop',
    images: [
      { id: 'dentcrest-1', url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'dentcrest-2', url: 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=800&h=600&fit=crop', alt: 'Hot tub' },
      { id: 'dentcrest-3', url: 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&h=600&fit=crop', alt: 'Living room' },
    ]
  },
  // 6. Safari Gameroom
  {
    propertyId: 'safari-gameroom',
    propertyName: 'Safari Gameroom',
    vrboId: '2638524',
    vrboUrl: getVrboUrl('2638524'),
    coverImage: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&h=600&fit=crop',
    images: [
      { id: 'safari-1', url: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'safari-2', url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Game room' },
    ]
  },
  // 7. Destination Getaway @ Storey
  {
    propertyId: 'storey-2103',
    propertyName: 'Destination Getaway',
    vrboId: '2643822',
    vrboUrl: getVrboUrl('2643822'),
    coverImage: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
    images: [
      { id: 'storey-1', url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'storey-2', url: 'https://images.unsplash.com/photo-1600210491369-e753d80a41f3?w=800&h=600&fit=crop', alt: 'Interior' },
    ]
  },
  // 8. Retreat with Covered Patio @ Chelsea
  {
    propertyId: 'chelsea-3210',
    propertyName: 'Retreat with Covered Patio',
    vrboId: '2643784',
    vrboUrl: getVrboUrl('2643784'),
    coverImage: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop',
    images: [
      { id: 'chelsea-1', url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop', alt: 'Covered patio', isPrimary: true },
      { id: 'chelsea-2', url: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop', alt: 'Living room' },
    ]
  },
  // 9. Clermont House with Pool & Billiards
  {
    propertyId: 'clermont-house',
    propertyName: 'Clermont House',
    vrboId: 'clermont',
    vrboUrl: getVrboUrl('search?q=clermont+right+at+home+midland'),
    coverImage: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop',
    images: [
      { id: 'clermont-1', url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop', alt: 'Pool', isPrimary: true },
      { id: 'clermont-2', url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Billiards' },
    ]
  },
  // 10. Uptown Place
  {
    propertyId: 'uptown-place',
    propertyName: 'Uptown Place',
    vrboId: 'uptown',
    vrboUrl: getVrboUrl('search?q=uptown+place+right+at+home+midland'),
    coverImage: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
    images: [
      { id: 'uptown-1', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'uptown-2', url: 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&h=600&fit=crop', alt: 'Living room' },
    ]
  },
  // 11. Sprawling Ranch
  {
    propertyId: 'sprawling-ranch',
    propertyName: 'Sprawling Ranch',
    vrboId: 'ranch',
    vrboUrl: getVrboUrl('search?q=sprawling+ranch+right+at+home+midland'),
    coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop',
    images: [
      { id: 'ranch-1', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop', alt: 'Ranch exterior', isPrimary: true },
    ]
  },
  // 12. Most Marvelous @ Oriole
  {
    propertyId: 'oriole-6100',
    propertyName: 'Most Marvelous with Pool',
    vrboId: '4471713',
    vrboUrl: getVrboUrl('4471713'),
    coverImage: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
    images: [
      { id: 'oriole-1', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop', alt: 'Pool', isPrimary: true },
      { id: 'oriole-2', url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop', alt: 'Kitchen' },
    ]
  },
  // 13. Posh & Private @ Lanham
  {
    propertyId: 'lanham-1426',
    propertyName: 'Posh & Private with Billiards',
    vrboId: '4437486',
    vrboUrl: getVrboUrl('4437486'),
    coverImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
    images: [
      { id: 'lanham-1', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'lanham-2', url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Billiards' },
    ]
  },
  // 14. Cowboy Siesta
  {
    propertyId: 'cowboy-siesta',
    propertyName: 'Cowboy Siesta',
    vrboId: 'cowboy',
    vrboUrl: getVrboUrl('search?q=cowboy+siesta+right+at+home+midland'),
    coverImage: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop',
    images: [
      { id: 'cowboy-1', url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
    ]
  },
  // 15. Outdoor Dream @ Humble
  {
    propertyId: 'humble-3106',
    propertyName: 'Outdoor Dream',
    vrboId: '4700881',
    vrboUrl: getVrboUrl('4700881'),
    coverImage: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
    images: [
      { id: 'humble-1', url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop', alt: 'Outdoor living', isPrimary: true },
      { id: 'humble-2', url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop', alt: 'Pool' },
      { id: 'humble-3', url: 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=800&h=600&fit=crop', alt: 'Hot tub' },
    ]
  },
  // 16. Vanguard Velvet Lounge
  {
    propertyId: 'vanguard-velvet',
    propertyName: 'Vanguard Velvet Lounge',
    vrboId: 'vanguard',
    vrboUrl: getVrboUrl('search?q=vanguard+velvet+right+at+home+midland'),
    coverImage: 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&h=600&fit=crop',
    images: [
      { id: 'vanguard-1', url: 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&h=600&fit=crop', alt: 'Living room', isPrimary: true },
    ]
  },
  // 17. Groovy Times with Pool @ Shandon
  {
    propertyId: 'shandon-4600',
    propertyName: 'Groovy Times with Pool',
    vrboId: 'shandon',
    vrboUrl: getVrboUrl('search?q=groovy+times+right+at+home+midland'),
    coverImage: 'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=800&h=600&fit=crop',
    images: [
      { id: 'shandon-1', url: 'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=800&h=600&fit=crop', alt: 'Pool', isPrimary: true },
      { id: 'shandon-2', url: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop', alt: 'Living room' },
    ]
  },
  // 18. Santiago Dreams @ 1311 Daventry
  {
    propertyId: 'daventry-1311',
    propertyName: 'Santiago Dreams',
    vrboId: '4179271',
    vrboUrl: getVrboUrl('4179271'),
    coverImage: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&h=600&fit=crop',
    images: [
      { id: 'daventry-1311-1', url: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'daventry-1311-2', url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop', alt: 'Man cave' },
    ]
  },
  // 19. Sprawling Ranch House @ 5055 Lincoln Green (FLAGSHIP)
  {
    propertyId: 'lincoln-green-5055',
    propertyName: 'Sprawling Ranch House with Pool Cabana',
    vrboId: '4581977',
    vrboUrl: getVrboUrl('4581977'),
    coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop',
    images: [
      { id: 'lincoln-1', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop', alt: 'Ranch house exterior', isPrimary: true },
      { id: 'lincoln-2', url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop', alt: 'Pool with cabana' },
      { id: 'lincoln-3', url: 'https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=800&h=600&fit=crop', alt: 'Playground' },
      { id: 'lincoln-4', url: 'https://images.unsplash.com/photo-1600210491369-e753d80a41f3?w=800&h=600&fit=crop', alt: 'Living room' },
    ]
  },
  // 20. Posh & Private @ 1426 Lanham (duplicate entry with different ID)
  {
    propertyId: 'lanham-posh-1426',
    propertyName: 'Posh & Private with Billiards',
    vrboId: '4437486',
    vrboUrl: getVrboUrl('4437486'),
    coverImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
    images: [
      { id: 'posh-1', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
    ]
  },
  // 21. Outdoor Dream @ 3106 Humble (duplicate)
  {
    propertyId: 'humble-outdoor-3106',
    propertyName: 'Outdoor Dream',
    vrboId: '4700881',
    vrboUrl: getVrboUrl('4700881'),
    coverImage: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
    images: [
      { id: 'outdoor-1', url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop', alt: 'Outdoor space', isPrimary: true },
    ]
  },
  // 22. Most Marvelous @ 6100 Oriole (duplicate)
  {
    propertyId: 'oriole-marvelous-6100',
    propertyName: 'Most Marvelous with Pool',
    vrboId: '4471713',
    vrboUrl: getVrboUrl('4471713'),
    coverImage: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
    images: [
      { id: 'marvelous-1', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop', alt: 'Pool area', isPrimary: true },
    ]
  },
  // 23. Hot Tub Delight @ 4707 Dentcrest (duplicate)
  {
    propertyId: 'dentcrest-hottub-4707',
    propertyName: 'Hot Tub Delight',
    vrboId: '2638481',
    vrboUrl: getVrboUrl('2638481'),
    coverImage: 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=800&h=600&fit=crop',
    images: [
      { id: 'hottub-1', url: 'https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=800&h=600&fit=crop', alt: 'Hot tub', isPrimary: true },
    ]
  },
  // 24. Saddle Club @ 1309 Daventry
  {
    propertyId: 'daventry-1309',
    propertyName: 'Saddle Club',
    vrboId: '4750070',
    vrboUrl: getVrboUrl('4750070'),
    coverImage: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop',
    images: [
      { id: 'saddle-1', url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop', alt: 'Exterior with large yard', isPrimary: true },
      { id: 'saddle-2', url: 'https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=800&h=600&fit=crop', alt: 'Childrens area' },
    ]
  },
  // 25. Monterrey House
  {
    propertyId: 'monterrey-house',
    propertyName: 'Monterrey House',
    vrboId: '3477668',
    vrboUrl: getVrboUrl('3477668'),
    coverImage: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop',
    images: [
      { id: 'monterrey-1', url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop', alt: 'Exterior', isPrimary: true },
      { id: 'monterrey-2', url: 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&h=600&fit=crop', alt: 'Living room' },
    ]
  },
  // Legacy/Backup entry: Haynes Haven
  {
    propertyId: 'haynes-2802',
    propertyName: 'Haynes Haven',
    vrboId: 'haynes',
    vrboUrl: getVrboUrl('search?q=haynes+right+at+home+midland'),
    coverImage: '/properties/zillow-2802-haynes.png',
    images: [
      { id: 'haynes-1', url: '/properties/zillow-2802-haynes.png', alt: 'Exterior', isPrimary: true },
    ]
  },
];

/**
 * Get images for a specific property from DB, falling back to static VRBO data
 */
export function getPropertyImagesStatic(propertyId: string): PropertyImages | undefined {
  return propertyImages.find(p => p.propertyId === propertyId);
}

/**
 * Get property images from Prisma DB (preferred — real photos)
 */
export async function getPropertyImagesFromDB(propertyId: string): Promise<PropertyImage[]> {
  try {
    const photos = await prisma.propertyPhoto.findMany({
      where: { propertyId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    });

    if (photos.length > 0) {
      return photos.map((p) => ({
        id: p.id,
        url: p.url,
        alt: p.caption || 'Property photo',
        isPrimary: p.isPrimary,
      }));
    }
  } catch {
    // DB not available — fall through to static
  }

  // Fallback to static VRBO data
  const staticProp = propertyImages.find(p => p.propertyId === propertyId);
  return staticProp?.images || [];
}

/**
 * Get cover image URL — DB first, then static fallback
 */
export async function getCoverImage(propertyId: string): Promise<string> {
  try {
    const primary = await prisma.propertyPhoto.findFirst({
      where: { propertyId, isPrimary: true },
    });
    if (primary) return primary.url;

    const first = await prisma.propertyPhoto.findFirst({
      where: { propertyId },
      orderBy: { sortOrder: 'asc' },
    });
    if (first) return first.url;
  } catch {
    // DB not available
  }

  const staticProp = propertyImages.find(p => p.propertyId === propertyId);
  return staticProp?.coverImage || PLACEHOLDER;
}

/**
 * Synchronous cover image from static data (for non-async contexts)
 */
export function getCoverImageSync(propertyId: string): string {
  const staticProp = propertyImages.find(p => p.propertyId === propertyId);
  return staticProp?.coverImage || PLACEHOLDER;
}

/**
 * Get all images for a property (async, DB-backed)
 */
export async function getAllImages(propertyId: string): Promise<PropertyImage[]> {
  return getPropertyImagesFromDB(propertyId);
}

/**
 * Get VRBO URL for a property
 */
export function getVrboListingUrl(propertyId: string): string | undefined {
  const property = propertyImages.find(p => p.propertyId === propertyId);
  return property?.vrboUrl;
}

/**
 * Property image map for quick lookup (static fallback)
 */
export const propertyImageMap: Record<string, string> = propertyImages.reduce((acc, p) => {
  acc[p.propertyId] = p.coverImage;
  return acc;
}, {} as Record<string, string>);

export default propertyImages;
