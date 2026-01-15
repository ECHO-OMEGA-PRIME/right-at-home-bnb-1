"""
Photo Analysis Service for Right at Home BnB
GPT-4 Vision powered cleaning verification and property inspection
@author ECHO OMEGA PRIME
"""

import os
import base64
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from loguru import logger
from openai import AsyncOpenAI


class PhotoCategory(str, Enum):
    """Categories for property photos"""
    LIVING_ROOM = "living_room"
    BEDROOM = "bedroom"
    BATHROOM = "bathroom"
    KITCHEN = "kitchen"
    DINING = "dining"
    EXTERIOR = "exterior"
    POOL = "pool"
    AMENITY = "amenity"
    ISSUE = "issue"
    BEFORE = "before"
    AFTER = "after"
    OTHER = "other"


class CleanlinessLevel(str, Enum):
    """Cleanliness assessment levels"""
    EXCELLENT = "excellent"  # 9-10
    GOOD = "good"            # 7-8
    ACCEPTABLE = "acceptable"  # 5-6
    NEEDS_ATTENTION = "needs_attention"  # 3-4
    UNACCEPTABLE = "unacceptable"  # 1-2


@dataclass
class PhotoAnalysisResult:
    """Result of photo analysis"""
    success: bool
    category: Optional[PhotoCategory] = None
    cleanliness_score: Optional[int] = None
    cleanliness_level: Optional[CleanlinessLevel] = None
    issues_found: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    description: Optional[str] = None
    confidence: float = 0.0
    error: Optional[str] = None
    analyzed_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PropertyInspectionResult:
    """Result of full property inspection"""
    success: bool
    property_id: str
    overall_score: float = 0.0
    overall_level: Optional[CleanlinessLevel] = None
    room_scores: Dict[str, int] = field(default_factory=dict)
    total_issues: int = 0
    all_issues: List[Dict] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    ready_for_guest: bool = False
    photo_count: int = 0
    analyzed_at: datetime = field(default_factory=datetime.utcnow)


# Analysis prompts
CLEANING_ANALYSIS_PROMPT = """You are an expert property inspector for a premium short-term rental company.
Analyze this cleaning photo and provide a detailed assessment.

Rate the cleanliness from 1-10 where:
- 10: Spotless, hotel-quality, ready for VIP guests
- 7-9: Clean, minor dust or imperfections acceptable
- 5-6: Acceptable but noticeable issues
- 3-4: Needs attention, visible problems
- 1-2: Unacceptable, requires re-cleaning

Look for:
- Dust, dirt, stains, smudges
- Organized items, made beds, folded towels
- Trash, clutter, personal items left behind
- Floor cleanliness, carpet condition
- Bathroom: toilet, sink, mirror, shower cleanliness
- Kitchen: counters, appliances, dishes

Respond in JSON format:
{
    "category": "bedroom|bathroom|kitchen|living_room|dining|exterior|pool|amenity|other",
    "cleanliness_score": 1-10,
    "issues_found": ["list of specific issues"],
    "recommendations": ["list of recommendations"],
    "description": "brief description of what you see",
    "confidence": 0.0-1.0
}
"""

PROPERTY_LISTING_PROMPT = """You are a professional real estate photographer and property stager.
Analyze this property photo for listing quality.

Evaluate:
1. Photo composition and lighting
2. Room staging and appeal
3. Cleanliness and organization
4. Potential guest appeal

Respond in JSON format:
{
    "category": "bedroom|bathroom|kitchen|living_room|dining|exterior|pool|amenity|other",
    "listing_quality_score": 1-10,
    "staging_quality": "excellent|good|needs_improvement|poor",
    "lighting_quality": "excellent|good|needs_improvement|poor",
    "suggestions": ["list of improvement suggestions"],
    "description": "brief description of the space",
    "highlights": ["list of positive features to mention in listing"]
}
"""

ISSUE_DETECTION_PROMPT = """You are a property maintenance expert for a short-term rental company.
Analyze this photo for any maintenance issues, damage, or safety concerns.

Look for:
- Damage: cracks, holes, stains, broken items
- Safety: exposed wires, loose fixtures, trip hazards
- Wear: fading, peeling, rust, deterioration
- Cleanliness: mold, mildew, pest evidence
- Missing items: burnt out bulbs, missing hardware

Respond in JSON format:
{
    "issues_detected": true/false,
    "severity": "critical|high|medium|low|none",
    "issues": [
        {
            "description": "description of issue",
            "location": "where in the photo",
            "severity": "critical|high|medium|low",
            "recommended_action": "what to do"
        }
    ],
    "maintenance_needed": true/false,
    "estimated_urgency": "immediate|this_week|this_month|can_wait"
}
"""


class PhotoAnalysisService:
    """
    GPT-4 Vision powered photo analysis for:
    - Cleaning verification
    - Property inspection
    - Issue detection
    - Listing optimization
    """

    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"  # GPT-4 Vision
        self.max_tokens = 1500

    async def _encode_image(self, image_source: str) -> str:
        """Encode image to base64 from URL or file path."""
        if image_source.startswith(("http://", "https://")):
            # Fetch from URL
            async with httpx.AsyncClient() as client:
                response = await client.get(image_source)
                response.raise_for_status()
                image_data = response.content
        else:
            # Read from file
            with open(image_source, "rb") as f:
                image_data = f.read()

        return base64.b64encode(image_data).decode("utf-8")

    async def _analyze_image(
        self,
        image_source: str,
        prompt: str,
        detail: str = "high"
    ) -> Dict[str, Any]:
        """Core image analysis with GPT-4 Vision."""
        try:
            # Prepare image content
            if image_source.startswith(("http://", "https://")):
                image_content = {
                    "type": "image_url",
                    "image_url": {
                        "url": image_source,
                        "detail": detail
                    }
                }
            else:
                # Base64 encode local file
                base64_image = await self._encode_image(image_source)
                image_content = {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}",
                        "detail": detail
                    }
                }

            # Call GPT-4 Vision
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            image_content
                        ]
                    }
                ],
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"}
            )

            # Parse response
            import json
            result = json.loads(response.choices[0].message.content)
            result["tokens_used"] = response.usage.total_tokens
            return result

        except Exception as e:
            logger.error(f"Image analysis error: {e}")
            return {"error": str(e)}

    async def analyze_cleaning_photo(
        self,
        image_source: str,
        room_hint: Optional[str] = None
    ) -> PhotoAnalysisResult:
        """
        Analyze a cleaning verification photo.

        Args:
            image_source: URL or file path to image
            room_hint: Optional hint about room type

        Returns:
            PhotoAnalysisResult with score and issues
        """
        prompt = CLEANING_ANALYSIS_PROMPT
        if room_hint:
            prompt += f"\n\nThis photo is from the {room_hint}."

        result = await self._analyze_image(image_source, prompt)

        if "error" in result:
            return PhotoAnalysisResult(
                success=False,
                error=result["error"]
            )

        # Map score to level
        score = result.get("cleanliness_score", 5)
        if score >= 9:
            level = CleanlinessLevel.EXCELLENT
        elif score >= 7:
            level = CleanlinessLevel.GOOD
        elif score >= 5:
            level = CleanlinessLevel.ACCEPTABLE
        elif score >= 3:
            level = CleanlinessLevel.NEEDS_ATTENTION
        else:
            level = CleanlinessLevel.UNACCEPTABLE

        return PhotoAnalysisResult(
            success=True,
            category=PhotoCategory(result.get("category", "other")),
            cleanliness_score=score,
            cleanliness_level=level,
            issues_found=result.get("issues_found", []),
            recommendations=result.get("recommendations", []),
            description=result.get("description"),
            confidence=result.get("confidence", 0.8)
        )

    async def analyze_property_listing_photo(
        self,
        image_source: str
    ) -> Dict[str, Any]:
        """Analyze a property listing photo for quality and staging."""
        result = await self._analyze_image(image_source, PROPERTY_LISTING_PROMPT)

        if "error" in result:
            return {"success": False, "error": result["error"]}

        return {
            "success": True,
            **result,
            "analyzed_at": datetime.utcnow().isoformat()
        }

    async def detect_issues(
        self,
        image_source: str
    ) -> Dict[str, Any]:
        """Detect maintenance issues in a property photo."""
        result = await self._analyze_image(image_source, ISSUE_DETECTION_PROMPT)

        if "error" in result:
            return {"success": False, "error": result["error"]}

        return {
            "success": True,
            **result,
            "analyzed_at": datetime.utcnow().isoformat()
        }

    async def verify_cleaning_job(
        self,
        photos: List[str],
        property_id: str,
        minimum_score: int = 7,
        minimum_photos: int = 5
    ) -> PropertyInspectionResult:
        """
        Verify a complete cleaning job from multiple photos.

        Args:
            photos: List of photo URLs or paths
            property_id: Property identifier
            minimum_score: Minimum acceptable score (default 7)
            minimum_photos: Minimum required photos (default 5)

        Returns:
            PropertyInspectionResult with overall assessment
        """
        if len(photos) < minimum_photos:
            return PropertyInspectionResult(
                success=False,
                property_id=property_id,
                photo_count=len(photos),
                all_issues=[{
                    "type": "insufficient_photos",
                    "message": f"Minimum {minimum_photos} photos required, got {len(photos)}"
                }]
            )

        results = []
        room_scores = {}
        all_issues = []
        all_recommendations = set()

        for photo in photos:
            analysis = await self.analyze_cleaning_photo(photo)
            if analysis.success:
                results.append(analysis)

                # Track room scores
                room_key = analysis.category.value if analysis.category else "other"
                if room_key not in room_scores:
                    room_scores[room_key] = []
                room_scores[room_key].append(analysis.cleanliness_score)

                # Collect issues
                for issue in analysis.issues_found:
                    all_issues.append({
                        "room": room_key,
                        "issue": issue,
                        "photo": photo
                    })

                # Collect recommendations
                all_recommendations.update(analysis.recommendations)

        if not results:
            return PropertyInspectionResult(
                success=False,
                property_id=property_id,
                photo_count=len(photos),
                all_issues=[{"type": "analysis_failed", "message": "Could not analyze any photos"}]
            )

        # Calculate averages
        avg_room_scores = {
            room: round(sum(scores) / len(scores), 1)
            for room, scores in room_scores.items()
        }
        overall_score = round(sum(r.cleanliness_score for r in results) / len(results), 1)

        # Determine overall level
        if overall_score >= 9:
            overall_level = CleanlinessLevel.EXCELLENT
        elif overall_score >= 7:
            overall_level = CleanlinessLevel.GOOD
        elif overall_score >= 5:
            overall_level = CleanlinessLevel.ACCEPTABLE
        elif overall_score >= 3:
            overall_level = CleanlinessLevel.NEEDS_ATTENTION
        else:
            overall_level = CleanlinessLevel.UNACCEPTABLE

        # Ready for guest?
        ready_for_guest = overall_score >= minimum_score and len(all_issues) <= 2

        return PropertyInspectionResult(
            success=True,
            property_id=property_id,
            overall_score=overall_score,
            overall_level=overall_level,
            room_scores=avg_room_scores,
            total_issues=len(all_issues),
            all_issues=all_issues,
            recommendations=list(all_recommendations),
            ready_for_guest=ready_for_guest,
            photo_count=len(photos)
        )

    async def compare_before_after(
        self,
        before_image: str,
        after_image: str
    ) -> Dict[str, Any]:
        """Compare before and after cleaning photos."""
        before_result = await self.analyze_cleaning_photo(before_image, room_hint=None)
        after_result = await self.analyze_cleaning_photo(after_image, room_hint=None)

        if not before_result.success or not after_result.success:
            return {
                "success": False,
                "error": "Failed to analyze one or both images"
            }

        score_improvement = (after_result.cleanliness_score or 0) - (before_result.cleanliness_score or 0)

        return {
            "success": True,
            "before": {
                "score": before_result.cleanliness_score,
                "level": before_result.cleanliness_level.value if before_result.cleanliness_level else None,
                "issues": before_result.issues_found
            },
            "after": {
                "score": after_result.cleanliness_score,
                "level": after_result.cleanliness_level.value if after_result.cleanliness_level else None,
                "issues": after_result.issues_found
            },
            "improvement": {
                "score_change": score_improvement,
                "issues_resolved": len(before_result.issues_found) - len(after_result.issues_found),
                "passed": after_result.cleanliness_score >= 7
            },
            "analyzed_at": datetime.utcnow().isoformat()
        }

    async def generate_listing_caption(
        self,
        image_source: str,
        property_name: str,
        style: str = "professional"
    ) -> Dict[str, Any]:
        """Generate a listing caption for a property photo."""
        prompt = f"""You are a real estate copywriter. Generate a compelling caption for this property photo.

Property name: {property_name}
Style: {style}

Respond in JSON format:
{{
    "caption": "engaging caption for the photo",
    "alt_text": "accessibility alt text",
    "hashtags": ["relevant", "hashtags"],
    "highlight": "main feature to highlight"
}}
"""
        result = await self._analyze_image(image_source, prompt)

        if "error" in result:
            return {"success": False, "error": result["error"]}

        return {
            "success": True,
            **result,
            "property_name": property_name
        }


# Singleton instance
photo_analysis_service = PhotoAnalysisService()


# Quick helper functions
async def verify_cleaning(photos: List[str], property_id: str) -> PropertyInspectionResult:
    """Quick helper to verify a cleaning job."""
    return await photo_analysis_service.verify_cleaning_job(photos, property_id)


async def analyze_photo(image_source: str) -> PhotoAnalysisResult:
    """Quick helper to analyze a single photo."""
    return await photo_analysis_service.analyze_cleaning_photo(image_source)


async def detect_maintenance_issues(image_source: str) -> Dict[str, Any]:
    """Quick helper to detect maintenance issues."""
    return await photo_analysis_service.detect_issues(image_source)
