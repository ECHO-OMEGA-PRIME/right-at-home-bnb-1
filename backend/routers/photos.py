"""
Photo Management System for Right at Home BnB
Firebase Storage integration with AI-based organization
@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from loguru import logger
from enum import Enum
import uuid
import os
import io
import httpx
from PIL import Image

from database.connection import get_db
from database.models import Property

# Firebase imports
import firebase_admin
from firebase_admin import credentials, storage
from google.cloud import storage as gcs_storage


router = APIRouter()


# ============================================
# ENUMS & MODELS
# ============================================

class PhotoCategory(str, Enum):
    EXTERIOR = "exterior"
    LIVING_ROOM = "living_room"
    KITCHEN = "kitchen"
    BEDROOM = "bedroom"
    BATHROOM = "bathroom"
    POOL = "pool"
    AMENITIES = "amenities"
    OTHER = "other"


# Photo metadata stored in database (could extend models.py)
# For now using in-memory storage with Firebase metadata
PHOTO_STORAGE: dict = {}  # In production, use database


# ============================================
# FIREBASE STORAGE SERVICE
# ============================================

class FirebaseStorageService:
    """Firebase Storage integration for photo management"""

    def __init__(self):
        self.bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "echo-prime-ai.appspot.com")
        self.initialized = False
        self._init_firebase()

    def _init_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check if already initialized
            if not firebase_admin._apps:
                # Try to get credentials from environment or file
                cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred, {
                        'storageBucket': self.bucket_name
                    })
                else:
                    # Initialize with default credentials (for Cloud Run)
                    firebase_admin.initialize_app(options={
                        'storageBucket': self.bucket_name
                    })

            self.bucket = storage.bucket()
            self.initialized = True
            logger.info(f"Firebase Storage initialized: {self.bucket_name}")
        except Exception as e:
            logger.warning(f"Firebase Storage init failed: {e}")
            self.initialized = False

    async def upload_photo(
        self,
        file: UploadFile,
        property_id: str,
        category: PhotoCategory,
        filename: Optional[str] = None
    ) -> dict:
        """Upload photo to Firebase Storage"""
        if not self.initialized:
            raise HTTPException(status_code=503, detail="Storage service unavailable")

        try:
            # Generate unique filename
            ext = file.filename.split('.')[-1] if file.filename else 'jpg'
            photo_id = str(uuid.uuid4())
            filename = filename or f"{photo_id}.{ext}"

            # Create storage path: properties/{property_id}/photos/{category}/{filename}
            blob_path = f"properties/{property_id}/photos/{category.value}/{filename}"

            # Read file content
            content = await file.read()

            # Upload to Firebase Storage
            blob = self.bucket.blob(blob_path)
            blob.upload_from_string(
                content,
                content_type=file.content_type or 'image/jpeg'
            )

            # Make publicly accessible
            blob.make_public()

            # Get public URL
            public_url = blob.public_url

            # Generate thumbnail
            thumbnail_url = await self._generate_thumbnail(content, property_id, photo_id, ext)

            return {
                "id": photo_id,
                "url": public_url,
                "thumbnail_url": thumbnail_url,
                "blob_path": blob_path,
                "category": category.value,
                "property_id": property_id,
                "filename": filename,
                "size_bytes": len(content),
                "content_type": file.content_type,
                "uploaded_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Photo upload error: {e}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    async def _generate_thumbnail(
        self,
        content: bytes,
        property_id: str,
        photo_id: str,
        ext: str,
        size: tuple = (300, 200)
    ) -> Optional[str]:
        """Generate and upload thumbnail"""
        try:
            # Open image and create thumbnail
            img = Image.open(io.BytesIO(content))
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # Convert to bytes
            thumb_buffer = io.BytesIO()
            img_format = 'JPEG' if ext.lower() in ['jpg', 'jpeg'] else 'PNG'
            img.save(thumb_buffer, format=img_format, quality=85)
            thumb_content = thumb_buffer.getvalue()

            # Upload thumbnail
            thumb_path = f"properties/{property_id}/photos/thumbnails/{photo_id}_thumb.{ext}"
            blob = self.bucket.blob(thumb_path)
            blob.upload_from_string(
                thumb_content,
                content_type=f'image/{img_format.lower()}'
            )
            blob.make_public()

            return blob.public_url

        except Exception as e:
            logger.warning(f"Thumbnail generation failed: {e}")
            return None

    async def delete_photo(self, blob_path: str) -> bool:
        """Delete photo from Firebase Storage"""
        if not self.initialized:
            return False

        try:
            blob = self.bucket.blob(blob_path)
            blob.delete()

            # Also try to delete thumbnail
            if '/photos/' in blob_path and '/thumbnails/' not in blob_path:
                thumb_path = blob_path.replace('/photos/', '/photos/thumbnails/')
                thumb_path = thumb_path.rsplit('.', 1)[0] + '_thumb.' + thumb_path.rsplit('.', 1)[1]
                try:
                    thumb_blob = self.bucket.blob(thumb_path)
                    thumb_blob.delete()
                except:
                    pass

            return True
        except Exception as e:
            logger.error(f"Photo delete error: {e}")
            return False

    async def list_photos(self, property_id: str, category: Optional[PhotoCategory] = None) -> List[dict]:
        """List all photos for a property"""
        if not self.initialized:
            return []

        try:
            prefix = f"properties/{property_id}/photos/"
            if category:
                prefix += f"{category.value}/"

            blobs = self.bucket.list_blobs(prefix=prefix)

            photos = []
            for blob in blobs:
                # Skip thumbnails in main listing
                if '/thumbnails/' in blob.name:
                    continue

                # Extract category from path
                parts = blob.name.split('/')
                if len(parts) >= 4:
                    cat = parts[3]
                else:
                    cat = 'other'

                photos.append({
                    "id": blob.name.split('/')[-1].split('.')[0],
                    "url": blob.public_url if blob.public_url else f"https://storage.googleapis.com/{self.bucket_name}/{blob.name}",
                    "blob_path": blob.name,
                    "category": cat,
                    "filename": blob.name.split('/')[-1],
                    "size_bytes": blob.size,
                    "content_type": blob.content_type,
                    "updated_at": blob.updated.isoformat() if blob.updated else None
                })

            return photos

        except Exception as e:
            logger.error(f"List photos error: {e}")
            return []


# Initialize storage service
storage_service = FirebaseStorageService()


# ============================================
# API ROUTES
# ============================================

@router.post("/upload")
async def upload_photo(
    file: UploadFile = File(...),
    property_id: str = Form(...),
    category: PhotoCategory = Form(PhotoCategory.OTHER),
    is_primary: bool = Form(False),
    alt_text: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload a photo with metadata.

    - **file**: Image file (JPEG, PNG, WebP)
    - **property_id**: Property the photo belongs to
    - **category**: Photo category (exterior, living_room, kitchen, etc.)
    - **is_primary**: Set as primary/cover photo for property
    - **alt_text**: Accessibility text description
    """
    # Validate property exists
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    # Validate file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 10MB.")

    # Reset file position
    await file.seek(0)

    # Upload to Firebase
    result = await storage_service.upload_photo(file, property_id, category)

    # Store metadata
    photo_data = {
        **result,
        "is_primary": is_primary,
        "alt_text": alt_text,
        "display_order": len(PHOTO_STORAGE.get(property_id, [])) + 1
    }

    if property_id not in PHOTO_STORAGE:
        PHOTO_STORAGE[property_id] = []

    # If set as primary, unset others
    if is_primary:
        for p in PHOTO_STORAGE[property_id]:
            p["is_primary"] = False

    PHOTO_STORAGE[property_id].append(photo_data)

    logger.info(f"Photo uploaded: {result['id']} for property {property_id}")

    return {
        "success": True,
        "message": "Photo uploaded successfully",
        "photo": photo_data
    }


@router.post("/upload/bulk")
async def upload_photos_bulk(
    files: List[UploadFile] = File(...),
    property_id: str = Form(...),
    category: PhotoCategory = Form(PhotoCategory.OTHER),
    db: Session = Depends(get_db)
):
    """
    Upload multiple photos at once.

    - **files**: List of image files
    - **property_id**: Property the photos belong to
    - **category**: Category for all uploaded photos
    """
    # Validate property exists
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    results = []
    errors = []

    for file in files:
        try:
            result = await storage_service.upload_photo(file, property_id, category)

            photo_data = {
                **result,
                "is_primary": False,
                "alt_text": None,
                "display_order": len(PHOTO_STORAGE.get(property_id, [])) + len(results) + 1
            }

            if property_id not in PHOTO_STORAGE:
                PHOTO_STORAGE[property_id] = []
            PHOTO_STORAGE[property_id].append(photo_data)

            results.append(photo_data)
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })

    return {
        "success": True,
        "uploaded": len(results),
        "failed": len(errors),
        "photos": results,
        "errors": errors
    }


@router.get("/property/{property_id}")
async def get_property_photos(
    property_id: str,
    category: Optional[PhotoCategory] = None,
    include_thumbnails: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    Get all photos for a property.

    - **property_id**: Property ID
    - **category**: Optional filter by category
    - **include_thumbnails**: Include thumbnail URLs
    """
    # Validate property exists
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Get photos from storage
    photos = await storage_service.list_photos(property_id, category)

    # Merge with local metadata
    local_photos = PHOTO_STORAGE.get(property_id, [])

    # Create lookup by ID
    local_lookup = {p["id"]: p for p in local_photos}

    # Enrich storage photos with metadata
    for photo in photos:
        if photo["id"] in local_lookup:
            photo.update({
                "is_primary": local_lookup[photo["id"]].get("is_primary", False),
                "alt_text": local_lookup[photo["id"]].get("alt_text"),
                "display_order": local_lookup[photo["id"]].get("display_order", 0),
                "thumbnail_url": local_lookup[photo["id"]].get("thumbnail_url")
            })
        else:
            photo.update({
                "is_primary": False,
                "alt_text": None,
                "display_order": 999
            })

    # Sort by display order, primary first
    photos.sort(key=lambda p: (not p.get("is_primary", False), p.get("display_order", 999)))

    # Group by category
    by_category = {}
    for photo in photos:
        cat = photo.get("category", "other")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(photo)

    return {
        "property_id": property_id,
        "property_name": prop.name,
        "total_photos": len(photos),
        "photos": photos,
        "by_category": by_category,
        "categories": list(by_category.keys())
    }


@router.delete("/{photo_id}")
async def delete_photo(
    photo_id: str,
    property_id: str = Query(..., description="Property ID"),
    db: Session = Depends(get_db)
):
    """
    Delete a photo.

    - **photo_id**: Photo ID to delete
    - **property_id**: Property the photo belongs to
    """
    # Find photo in local storage
    if property_id not in PHOTO_STORAGE:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo = None
    photo_index = None
    for i, p in enumerate(PHOTO_STORAGE[property_id]):
        if p["id"] == photo_id:
            photo = p
            photo_index = i
            break

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Delete from Firebase Storage
    deleted = await storage_service.delete_photo(photo["blob_path"])

    if deleted:
        # Remove from local storage
        PHOTO_STORAGE[property_id].pop(photo_index)

        # Reorder remaining photos
        for i, p in enumerate(PHOTO_STORAGE[property_id]):
            p["display_order"] = i + 1

        logger.info(f"Photo deleted: {photo_id} from property {property_id}")

        return {
            "success": True,
            "message": "Photo deleted successfully",
            "deleted_id": photo_id
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to delete photo from storage")


@router.put("/{photo_id}/primary")
async def set_primary_photo(
    photo_id: str,
    property_id: str = Query(..., description="Property ID"),
    db: Session = Depends(get_db)
):
    """
    Set a photo as the primary/cover photo for a property.

    - **photo_id**: Photo ID to set as primary
    - **property_id**: Property the photo belongs to
    """
    if property_id not in PHOTO_STORAGE:
        raise HTTPException(status_code=404, detail="Property photos not found")

    found = False
    for photo in PHOTO_STORAGE[property_id]:
        if photo["id"] == photo_id:
            photo["is_primary"] = True
            found = True
        else:
            photo["is_primary"] = False

    if not found:
        raise HTTPException(status_code=404, detail="Photo not found")

    logger.info(f"Primary photo set: {photo_id} for property {property_id}")

    return {
        "success": True,
        "message": "Primary photo updated",
        "photo_id": photo_id
    }


@router.put("/{photo_id}/metadata")
async def update_photo_metadata(
    photo_id: str,
    property_id: str = Query(...),
    alt_text: Optional[str] = None,
    category: Optional[PhotoCategory] = None,
    display_order: Optional[int] = None
):
    """
    Update photo metadata.

    - **photo_id**: Photo ID
    - **property_id**: Property ID
    - **alt_text**: New alt text
    - **category**: New category
    - **display_order**: New display order
    """
    if property_id not in PHOTO_STORAGE:
        raise HTTPException(status_code=404, detail="Property photos not found")

    photo = None
    for p in PHOTO_STORAGE[property_id]:
        if p["id"] == photo_id:
            photo = p
            break

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Update fields if provided
    if alt_text is not None:
        photo["alt_text"] = alt_text
    if category is not None:
        photo["category"] = category.value
    if display_order is not None:
        photo["display_order"] = display_order

    return {
        "success": True,
        "message": "Photo metadata updated",
        "photo": photo
    }


@router.post("/organize")
async def organize_photos_ai(
    property_id: str = Form(...),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    """
    AI-based photo organization.
    Uses GPT-4 Vision to automatically categorize and order photos.

    - **property_id**: Property to organize photos for
    """
    from services.photo_analysis import photo_analysis_service

    # Validate property exists
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Get all photos
    photos = PHOTO_STORAGE.get(property_id, [])

    if not photos:
        return {
            "success": False,
            "message": "No photos to organize"
        }

    organized_photos = []
    category_counts = {}

    for photo in photos:
        try:
            # Analyze photo with AI
            analysis = await photo_analysis_service.analyze_property_listing_photo(photo["url"])

            if analysis.get("success"):
                # Update category from AI analysis
                ai_category = analysis.get("category", "other")
                if ai_category in [c.value for c in PhotoCategory]:
                    photo["category"] = ai_category
                    photo["ai_analyzed"] = True
                    photo["ai_description"] = analysis.get("description")
                    photo["ai_highlights"] = analysis.get("highlights", [])
                    photo["listing_quality_score"] = analysis.get("listing_quality_score")

                    # Track category counts
                    category_counts[ai_category] = category_counts.get(ai_category, 0) + 1

                organized_photos.append(photo)
        except Exception as e:
            logger.warning(f"AI analysis failed for photo {photo['id']}: {e}")
            organized_photos.append(photo)

    # Sort photos: exterior first, then by category quality score
    category_order = ['exterior', 'living_room', 'kitchen', 'bedroom', 'bathroom', 'pool', 'amenities', 'other']
    organized_photos.sort(
        key=lambda p: (
            category_order.index(p.get("category", "other")) if p.get("category", "other") in category_order else 99,
            -(p.get("listing_quality_score", 0) or 0)
        )
    )

    # Update display order
    for i, photo in enumerate(organized_photos):
        photo["display_order"] = i + 1

    # Set first exterior photo as primary if no primary set
    if not any(p.get("is_primary") for p in organized_photos):
        for photo in organized_photos:
            if photo.get("category") == "exterior":
                photo["is_primary"] = True
                break

    # Update storage
    PHOTO_STORAGE[property_id] = organized_photos

    return {
        "success": True,
        "message": "Photos organized with AI",
        "total_organized": len(organized_photos),
        "category_counts": category_counts,
        "photos": organized_photos
    }


@router.post("/reorder")
async def reorder_photos(
    property_id: str = Form(...),
    photo_order: List[str] = Form(..., description="List of photo IDs in desired order")
):
    """
    Manually reorder photos.

    - **property_id**: Property ID
    - **photo_order**: List of photo IDs in the desired display order
    """
    if property_id not in PHOTO_STORAGE:
        raise HTTPException(status_code=404, detail="Property photos not found")

    photos = PHOTO_STORAGE[property_id]
    photo_lookup = {p["id"]: p for p in photos}

    # Validate all IDs exist
    for photo_id in photo_order:
        if photo_id not in photo_lookup:
            raise HTTPException(status_code=400, detail=f"Photo {photo_id} not found")

    # Update display order based on provided order
    for i, photo_id in enumerate(photo_order):
        photo_lookup[photo_id]["display_order"] = i + 1

    # Sort photos by new order
    PHOTO_STORAGE[property_id] = sorted(photos, key=lambda p: p.get("display_order", 999))

    return {
        "success": True,
        "message": "Photos reordered successfully",
        "new_order": [p["id"] for p in PHOTO_STORAGE[property_id]]
    }


@router.get("/categories")
async def get_photo_categories():
    """Get all available photo categories with descriptions."""
    return {
        "categories": [
            {"value": "exterior", "label": "Exterior", "description": "Front of property, curb appeal, outdoor areas"},
            {"value": "living_room", "label": "Living Room", "description": "Main living/lounge area"},
            {"value": "kitchen", "label": "Kitchen", "description": "Kitchen and dining area"},
            {"value": "bedroom", "label": "Bedroom", "description": "Bedrooms and sleeping areas"},
            {"value": "bathroom", "label": "Bathroom", "description": "Bathrooms and powder rooms"},
            {"value": "pool", "label": "Pool", "description": "Pool, hot tub, and outdoor entertainment"},
            {"value": "amenities", "label": "Amenities", "description": "Special features, game rooms, etc."},
            {"value": "other", "label": "Other", "description": "Miscellaneous photos"}
        ]
    }


@router.get("/stats/{property_id}")
async def get_photo_stats(property_id: str, db: Session = Depends(get_db)):
    """Get photo statistics for a property."""
    photos = PHOTO_STORAGE.get(property_id, [])

    if not photos:
        return {
            "property_id": property_id,
            "total_photos": 0,
            "has_primary": False,
            "by_category": {},
            "total_size_mb": 0,
            "avg_quality_score": None
        }

    # Calculate stats
    by_category = {}
    total_size = 0
    quality_scores = []

    for photo in photos:
        cat = photo.get("category", "other")
        by_category[cat] = by_category.get(cat, 0) + 1
        total_size += photo.get("size_bytes", 0)
        if photo.get("listing_quality_score"):
            quality_scores.append(photo["listing_quality_score"])

    return {
        "property_id": property_id,
        "total_photos": len(photos),
        "has_primary": any(p.get("is_primary") for p in photos),
        "by_category": by_category,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "avg_quality_score": round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else None,
        "ai_analyzed_count": sum(1 for p in photos if p.get("ai_analyzed"))
    }
