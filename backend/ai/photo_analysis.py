"""
Right at Home BnB - Photo Analysis Service
==========================================
GPT-4 Vision powered cleaning verification and photo scoring.

Features:
- Cleanliness scoring 1-100
- Issue detection (stains, mess, damage)
- Before/after comparison
- Room-by-room analysis
- Automatic quality assurance
- Cleaner performance tracking

@author ECHO OMEGA PRIME
@owner Steven Palma - Right at Home BnB, Midland, TX
"""

import os
import io
import base64
from typing import Optional, Dict, Any, List, Union, Tuple
from datetime import datetime
from pathlib import Path
from enum import Enum
from dataclasses import dataclass
import httpx
from loguru import logger
from openai import AsyncOpenAI

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class RoomType(str, Enum):
    """Types of rooms to analyze."""
    BEDROOM = "bedroom"
    BATHROOM = "bathroom"
    KITCHEN = "kitchen"
    LIVING_ROOM = "living_room"
    DINING_ROOM = "dining_room"
    OUTDOOR = "outdoor"
    POOL = "pool"
    GARAGE = "garage"
    LAUNDRY = "laundry"
    HALLWAY = "hallway"
    GENERAL = "general"


class IssueType(str, Enum):
    """Types of cleaning issues."""
    STAIN = "stain"
    MESS = "mess"
    DAMAGE = "damage"
    MISSING_ITEM = "missing_item"
    SAFETY_HAZARD = "safety_hazard"
    MAINTENANCE = "maintenance"
    INCOMPLETE_CLEAN = "incomplete_clean"
    OTHER = "other"


class IssueSeverity(str, Enum):
    """Severity levels for issues."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class CleaningIssue:
    """Detected cleaning issue."""
    type: IssueType
    severity: IssueSeverity
    location: str
    description: str
    suggested_action: str


@dataclass
class PhotoAnalysisResult:
    """Result of photo analysis."""
    overall_score: int  # 1-100
    room_type: RoomType
    is_clean: bool
    issues: List[CleaningIssue]
    positive_notes: List[str]
    recommendations: List[str]
    ready_for_guest: bool
    confidence: float  # 0-1
    analysis_timestamp: str


class PhotoAnalysisService:
    """
    GPT-4 Vision powered photo analysis for cleaning verification.
    """

    def __init__(self):
        self.model = "gpt-4o"  # Use GPT-4o for vision
        self.max_tokens = 2000
        self.passing_score = 85  # Minimum score to pass inspection

    async def analyze_photo(
        self,
        image_data: Union[bytes, str],
        room_type: RoomType = RoomType.GENERAL,
        property_name: Optional[str] = None,
        cleaner_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a single photo for cleanliness.

        Args:
            image_data: Image bytes or base64 string
            room_type: Type of room being analyzed
            property_name: Optional property name for context
            cleaner_name: Optional cleaner name for tracking

        Returns:
            Dict with score, issues, recommendations
        """
        try:
            # Convert to base64 if bytes
            if isinstance(image_data, bytes):
                image_base64 = base64.b64encode(image_data).decode("utf-8")
            else:
                image_base64 = image_data

            # Build analysis prompt
            system_prompt = self._build_analysis_prompt(room_type)

            # Build user message with image
            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Please analyze this {room_type.value} photo for cleanliness and readiness for the next guest. Provide a detailed assessment."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ]

            # Call GPT-4 Vision
            response = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=0.3  # Lower temperature for consistent scoring
            )

            analysis_text = response.choices[0].message.content

            # Parse the analysis
            result = self._parse_analysis(analysis_text, room_type)

            return {
                "success": True,
                "score": result.overall_score,
                "is_clean": result.is_clean,
                "ready_for_guest": result.ready_for_guest,
                "room_type": result.room_type.value,
                "issues": [
                    {
                        "type": issue.type.value,
                        "severity": issue.severity.value,
                        "location": issue.location,
                        "description": issue.description,
                        "action": issue.suggested_action
                    }
                    for issue in result.issues
                ],
                "positive_notes": result.positive_notes,
                "recommendations": result.recommendations,
                "confidence": result.confidence,
                "property": property_name,
                "cleaner": cleaner_name,
                "raw_analysis": analysis_text,
                "tokens_used": {
                    "prompt": response.usage.prompt_tokens,
                    "completion": response.usage.completion_tokens,
                    "total": response.usage.total_tokens
                },
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Photo analysis error: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def compare_before_after(
        self,
        before_image: Union[bytes, str],
        after_image: Union[bytes, str],
        room_type: RoomType = RoomType.GENERAL
    ) -> Dict[str, Any]:
        """
        Compare before and after cleaning photos.

        Args:
            before_image: Image before cleaning (bytes or base64)
            after_image: Image after cleaning (bytes or base64)
            room_type: Type of room

        Returns:
            Dict with comparison analysis
        """
        try:
            # Convert to base64
            if isinstance(before_image, bytes):
                before_b64 = base64.b64encode(before_image).decode("utf-8")
            else:
                before_b64 = before_image

            if isinstance(after_image, bytes):
                after_b64 = base64.b64encode(after_image).decode("utf-8")
            else:
                after_b64 = after_image

            system_prompt = """You are a professional cleaning inspector for Right at Home BnB.
Compare these BEFORE and AFTER cleaning photos and provide:

1. IMPROVEMENT SCORE (1-100): How much cleaner is the after photo?
2. AREAS IMPROVED: List specific areas that improved
3. REMAINING ISSUES: Any issues still visible in the after photo
4. CLEANER PERFORMANCE: Rate the cleaning job quality
5. READY FOR GUEST: Is the space ready for the next guest?

Format your response as:
IMPROVEMENT_SCORE: [number]
BEFORE_ISSUES: [list of issues in before photo]
IMPROVEMENTS: [list of improvements made]
REMAINING_ISSUES: [list of any remaining issues]
CLEANER_RATING: [1-5 stars]
READY_FOR_GUEST: [YES/NO]
SUMMARY: [brief summary]
"""

            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Compare these {room_type.value} photos. First image is BEFORE cleaning, second is AFTER cleaning."},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{before_b64}", "detail": "high"}
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{after_b64}", "detail": "high"}
                        }
                    ]
                }
            ]

            response = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=0.3
            )

            analysis_text = response.choices[0].message.content
            comparison = self._parse_comparison(analysis_text)

            return {
                "success": True,
                "improvement_score": comparison.get("improvement_score", 0),
                "before_issues": comparison.get("before_issues", []),
                "improvements": comparison.get("improvements", []),
                "remaining_issues": comparison.get("remaining_issues", []),
                "cleaner_rating": comparison.get("cleaner_rating", 0),
                "ready_for_guest": comparison.get("ready_for_guest", False),
                "summary": comparison.get("summary", ""),
                "raw_analysis": analysis_text,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Comparison error: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def analyze_property_inspection(
        self,
        photos: List[Dict[str, Any]],
        property_id: str,
        cleaner_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze multiple photos for a complete property inspection.

        Args:
            photos: List of dicts with {image_data, room_type, room_name}
            property_id: Property identifier
            cleaner_id: Cleaner identifier

        Returns:
            Dict with overall inspection results
        """
        results = []
        total_score = 0
        all_issues = []
        all_recommendations = []

        for photo in photos:
            result = await self.analyze_photo(
                image_data=photo.get("image_data"),
                room_type=RoomType(photo.get("room_type", "general")),
                property_name=property_id
            )

            if result["success"]:
                results.append({
                    "room": photo.get("room_name", photo.get("room_type")),
                    "score": result["score"],
                    "issues": result["issues"],
                    "ready": result["ready_for_guest"]
                })
                total_score += result["score"]
                all_issues.extend(result["issues"])
                all_recommendations.extend(result.get("recommendations", []))

        # Calculate overall metrics
        room_count = len(results)
        average_score = total_score // room_count if room_count > 0 else 0
        critical_issues = [i for i in all_issues if i.get("severity") == "critical"]
        high_issues = [i for i in all_issues if i.get("severity") == "high"]

        # Determine if property passes inspection
        passes_inspection = (
            average_score >= self.passing_score and
            len(critical_issues) == 0 and
            all(r["ready"] for r in results)
        )

        return {
            "success": True,
            "property_id": property_id,
            "cleaner_id": cleaner_id,
            "overall_score": average_score,
            "passes_inspection": passes_inspection,
            "room_results": results,
            "total_issues": len(all_issues),
            "critical_issues": len(critical_issues),
            "high_priority_issues": len(high_issues),
            "issues_detail": all_issues,
            "recommendations": list(set(all_recommendations)),
            "rooms_inspected": room_count,
            "timestamp": datetime.utcnow().isoformat()
        }

    def _build_analysis_prompt(self, room_type: RoomType) -> str:
        """Build analysis prompt based on room type."""
        base_prompt = """You are a professional cleaning inspector for Right at Home BnB vacation rentals.
Analyze this photo and provide a detailed cleanliness assessment.

YOUR ASSESSMENT MUST INCLUDE:
1. CLEANLINESS SCORE (1-100)
   - 90-100: Exceptional, hotel quality
   - 80-89: Good, ready for guests
   - 70-79: Acceptable with minor issues
   - 60-69: Needs attention
   - Below 60: Not ready for guests

2. ISSUES FOUND (if any):
   - Type: stain, mess, damage, missing_item, safety_hazard, maintenance, incomplete_clean
   - Severity: low, medium, high, critical
   - Location: specific location in the room
   - Description: what the issue is
   - Action: how to fix it

3. POSITIVE NOTES: What looks good

4. RECOMMENDATIONS: Suggestions for improvement

5. READY FOR GUEST: YES or NO

Format your response EXACTLY as:
SCORE: [number]
IS_CLEAN: [YES/NO]
READY_FOR_GUEST: [YES/NO]
CONFIDENCE: [0.0-1.0]

ISSUES:
- [type] | [severity] | [location] | [description] | [action]

POSITIVES:
- [positive note]

RECOMMENDATIONS:
- [recommendation]

SUMMARY: [brief summary]
"""

        room_specifics = {
            RoomType.BEDROOM: """
BEDROOM SPECIFIC CHECKS:
- Bed made properly with clean linens
- Nightstands clear and dusted
- Floors vacuumed/clean
- Closet organized
- No personal items left behind
- Fresh smell, no odors
""",
            RoomType.BATHROOM: """
BATHROOM SPECIFIC CHECKS:
- Toilet clean inside and out
- Sink and counter spotless
- Mirror streak-free
- Shower/tub clean, no mold or soap scum
- Floors clean and dry
- Fresh towels folded neatly
- Toiletries stocked
- No hair visible anywhere
""",
            RoomType.KITCHEN: """
KITCHEN SPECIFIC CHECKS:
- Counters clean and clear
- Sink empty and clean
- Appliances clean (microwave, stove, oven)
- Refrigerator clean and empty
- Dishwasher empty and clean
- Cabinets organized
- Floors clean
- No food residue anywhere
""",
            RoomType.LIVING_ROOM: """
LIVING ROOM SPECIFIC CHECKS:
- Furniture arranged properly
- Cushions fluffed
- Surfaces dusted
- Floors vacuumed
- Windows and glass clean
- TV clean and remotes in place
- Decor straightened
""",
            RoomType.POOL: """
POOL AREA SPECIFIC CHECKS:
- Pool water clear
- No debris in pool
- Pool deck clean
- Furniture clean and arranged
- Safety equipment present
- No hazards visible
""",
            RoomType.OUTDOOR: """
OUTDOOR AREA SPECIFIC CHECKS:
- Patio/deck clean
- Furniture clean and arranged
- Grill clean (if present)
- No debris or litter
- Plants maintained
- Lighting functional
"""
        }

        return base_prompt + room_specifics.get(room_type, "")

    def _parse_analysis(self, text: str, room_type: RoomType) -> PhotoAnalysisResult:
        """Parse GPT-4 analysis text into structured result."""
        import re

        # Extract score
        score_match = re.search(r'SCORE:\s*(\d+)', text)
        score = int(score_match.group(1)) if score_match else 70

        # Extract is_clean
        is_clean = "IS_CLEAN: YES" in text.upper()

        # Extract ready_for_guest
        ready = "READY_FOR_GUEST: YES" in text.upper()

        # Extract confidence
        conf_match = re.search(r'CONFIDENCE:\s*([\d.]+)', text)
        confidence = float(conf_match.group(1)) if conf_match else 0.8

        # Extract issues
        issues = []
        issues_section = re.search(r'ISSUES:\s*(.*?)(?=POSITIVES:|RECOMMENDATIONS:|SUMMARY:|$)', text, re.DOTALL)
        if issues_section:
            issue_lines = issues_section.group(1).strip().split('\n')
            for line in issue_lines:
                if '|' in line:
                    parts = [p.strip() for p in line.replace('-', '').split('|')]
                    if len(parts) >= 5:
                        try:
                            issues.append(CleaningIssue(
                                type=IssueType(parts[0].lower()) if parts[0].lower() in [e.value for e in IssueType] else IssueType.OTHER,
                                severity=IssueSeverity(parts[1].lower()) if parts[1].lower() in [e.value for e in IssueSeverity] else IssueSeverity.MEDIUM,
                                location=parts[2],
                                description=parts[3],
                                suggested_action=parts[4]
                            ))
                        except (ValueError, IndexError):
                            pass

        # Extract positives
        positives = []
        pos_section = re.search(r'POSITIVES:\s*(.*?)(?=RECOMMENDATIONS:|SUMMARY:|$)', text, re.DOTALL)
        if pos_section:
            for line in pos_section.group(1).strip().split('\n'):
                if line.strip().startswith('-'):
                    positives.append(line.strip()[1:].strip())

        # Extract recommendations
        recommendations = []
        rec_section = re.search(r'RECOMMENDATIONS:\s*(.*?)(?=SUMMARY:|$)', text, re.DOTALL)
        if rec_section:
            for line in rec_section.group(1).strip().split('\n'):
                if line.strip().startswith('-'):
                    recommendations.append(line.strip()[1:].strip())

        return PhotoAnalysisResult(
            overall_score=score,
            room_type=room_type,
            is_clean=is_clean,
            issues=issues,
            positive_notes=positives,
            recommendations=recommendations,
            ready_for_guest=ready,
            confidence=confidence,
            analysis_timestamp=datetime.utcnow().isoformat()
        )

    def _parse_comparison(self, text: str) -> Dict[str, Any]:
        """Parse before/after comparison text."""
        import re

        result = {
            "improvement_score": 0,
            "before_issues": [],
            "improvements": [],
            "remaining_issues": [],
            "cleaner_rating": 0,
            "ready_for_guest": False,
            "summary": ""
        }

        # Extract improvement score
        score_match = re.search(r'IMPROVEMENT_SCORE:\s*(\d+)', text)
        if score_match:
            result["improvement_score"] = int(score_match.group(1))

        # Extract lists
        for field, pattern in [
            ("before_issues", r'BEFORE_ISSUES:\s*(.*?)(?=IMPROVEMENTS:|$)'),
            ("improvements", r'IMPROVEMENTS:\s*(.*?)(?=REMAINING_ISSUES:|$)'),
            ("remaining_issues", r'REMAINING_ISSUES:\s*(.*?)(?=CLEANER_RATING:|$)')
        ]:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                items = [line.strip()[1:].strip() for line in match.group(1).strip().split('\n')
                        if line.strip().startswith('-')]
                result[field] = items

        # Extract cleaner rating
        rating_match = re.search(r'CLEANER_RATING:\s*(\d)', text)
        if rating_match:
            result["cleaner_rating"] = int(rating_match.group(1))

        # Extract ready for guest
        result["ready_for_guest"] = "READY_FOR_GUEST: YES" in text.upper()

        # Extract summary
        summary_match = re.search(r'SUMMARY:\s*(.*?)$', text, re.DOTALL)
        if summary_match:
            result["summary"] = summary_match.group(1).strip()

        return result

    async def quick_check(self, image_data: Union[bytes, str]) -> Tuple[int, bool]:
        """Quick cleanliness check - returns (score, is_ready)."""
        result = await self.analyze_photo(image_data)
        if result["success"]:
            return result["score"], result["ready_for_guest"]
        return 0, False


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

photo_analysis_service = PhotoAnalysisService()


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def analyze_photo(image_data: Union[bytes, str], room_type: str = "general") -> Dict[str, Any]:
    """Quick helper to analyze a single photo."""
    return await photo_analysis_service.analyze_photo(
        image_data=image_data,
        room_type=RoomType(room_type) if room_type in [e.value for e in RoomType] else RoomType.GENERAL
    )


async def compare_photos(before: Union[bytes, str], after: Union[bytes, str]) -> Dict[str, Any]:
    """Quick helper to compare before/after photos."""
    return await photo_analysis_service.compare_before_after(before, after)


async def get_cleanliness_score(image_data: Union[bytes, str]) -> int:
    """Get just the cleanliness score for a photo."""
    score, _ = await photo_analysis_service.quick_check(image_data)
    return score


async def is_ready_for_guest(image_data: Union[bytes, str]) -> bool:
    """Check if a room is ready for guest based on photo."""
    _, ready = await photo_analysis_service.quick_check(image_data)
    return ready
