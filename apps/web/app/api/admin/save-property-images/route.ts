import { NextRequest, NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';

/**
 * Save Property Images API
 * Downloads images from VRBO and saves them to Firebase Storage
 * Updates Firestore property document with new image URLs
 *
 * @author ECHO OMEGA PRIME
 */

interface ImageInput {
  url: string;
  alt: string;
  isPrimary: boolean;
}

async function downloadAndUpload(
  storageInstance: Storage,
  imageUrl: string,
  propertyId: string,
  index: number
): Promise<string | null> {
  try {
    // Download image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';

    // Upload to Firebase Storage
    const bucket = storageInstance.bucket();
    const filePath = `properties/${propertyId}/images/${propertyId}_${String(index).padStart(2, '0')}.${ext}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          source: 'vrbo',
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Make file public
    await file.makePublic();

    // Return public URL
    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  } catch (error) {
    console.error(`Failed to upload image ${index}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { propertyId, images } = await request.json() as {
      propertyId: string;
      images: ImageInput[];
    };

    if (!propertyId || !images || images.length === 0) {
      return NextResponse.json(
        { error: 'Missing propertyId or images' },
        { status: 400 }
      );
    }

    // Check if Firebase Admin is available
    if (!db || !storage) {
      // Fallback: just return the URLs as-is without uploading
      console.warn('Firebase Admin not configured, skipping upload');

      const savedImages = images.map((img, index) => ({
        id: `${propertyId}-${index}`,
        url: img.url,
        alt: img.alt,
        isPrimary: img.isPrimary,
        source: 'vrbo-direct',
        savedAt: new Date().toISOString(),
      }));

      return NextResponse.json({
        propertyId,
        images: savedImages,
        uploaded: false,
        message: 'Images saved with direct VRBO URLs (Firebase upload not available)',
      });
    }

    // Download and upload each image
    const uploadedImages: Array<{
      id: string;
      url: string;
      alt: string;
      isPrimary: boolean;
      source: string;
      savedAt: string;
    }> = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const firebaseUrl = await downloadAndUpload(storage, img.url, propertyId, i);

      if (firebaseUrl) {
        uploadedImages.push({
          id: `${propertyId}-${i}`,
          url: firebaseUrl,
          alt: img.alt,
          isPrimary: img.isPrimary,
          source: 'vrbo',
          savedAt: new Date().toISOString(),
        });
      }
    }

    if (uploadedImages.length === 0) {
      return NextResponse.json(
        { error: 'Failed to upload any images' },
        { status: 500 }
      );
    }

    // Update Firestore property document
    const propertyRef = db.collection('properties').doc(propertyId);

    // Get existing images
    const propertyDoc = await propertyRef.get();
    const existingImages = propertyDoc.exists
      ? (propertyDoc.data()?.images || [])
      : [];

    // Merge with new images (avoiding duplicates)
    const existingUrls = new Set(existingImages.map((img: any) => img.url));
    const newImages = uploadedImages.filter(img => !existingUrls.has(img.url));
    const allImages = [...existingImages, ...newImages];

    // Find cover image
    const primaryImage = allImages.find((img: any) => img.isPrimary);
    const coverImage = primaryImage?.url || allImages[0]?.url;

    await propertyRef.set(
      {
        images: allImages,
        coverImage,
        imagesUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      propertyId,
      images: uploadedImages,
      totalImages: allImages.length,
      uploaded: true,
      coverImage,
    });
  } catch (error: any) {
    console.error('Save images error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save images' },
      { status: 500 }
    );
  }
}
