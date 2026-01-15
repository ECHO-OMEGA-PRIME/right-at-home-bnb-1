"""
Right at Home BnB - AI Routes
API endpoints for AI concierge and voice services
@author ECHO OMEGA PRIME
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from loguru import logger

from services.ai_concierge import ai_concierge
from services.voice_service import voice_service

router = APIRouter(prefix="/ai", tags=["AI Services"])


# Request/Response Models
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class GuestQuestionRequest(BaseModel):
    question: str
    guest_id: Optional[str] = None
    property_id: Optional[str] = None
    conversation_history: Optional[List[ChatMessage]] = None


class DraftMessageRequest(BaseModel):
    message_type: str  # welcome, checkout, response, followup, review_request
    guest_name: str
    property_name: str
    details: Optional[Dict[str, Any]] = None


class ReviewResponseRequest(BaseModel):
    review_text: str
    rating: int
    guest_name: str
    property_name: str


class PropertyDescriptionRequest(BaseModel):
    property_data: Dict[str, Any]
    style: str = "professional"  # professional, casual, luxury


class TextToSpeechRequest(BaseModel):
    text: str
    voice: str = "concierge"  # concierge, concierge_male, friendly, texas
    preset: str = "professional"  # professional, warm, friendly


class WelcomeMessageRequest(BaseModel):
    guest_name: str
    property_name: str
    check_in_code: Optional[str] = None


class CheckoutReminderRequest(BaseModel):
    guest_name: str
    checkout_time: str


class SentimentRequest(BaseModel):
    text: str


# Chat/Concierge Endpoints
@router.post("/chat")
async def chat_with_concierge(request: GuestQuestionRequest):
    """
    Send a message to the AI concierge and get a response.
    Can include conversation history for context.
    """
    # Convert conversation history format
    history = None
    if request.conversation_history:
        history = [{"role": msg.role, "content": msg.content} for msg in request.conversation_history]

    # Build context from IDs (would fetch from database)
    guest_context = None
    property_context = None

    if request.guest_id:
        guest_context = {"id": request.guest_id}  # Would fetch real guest data

    if request.property_id:
        property_context = {"id": request.property_id}  # Would fetch real property data

    result = await ai_concierge.answer_guest_question(
        question=request.question,
        guest_context=guest_context,
        property_context=property_context,
        conversation_history=history,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "AI service error"))

    return result


@router.post("/draft-message")
async def draft_message(request: DraftMessageRequest):
    """
    Generate a draft message for guest communication.
    Types: welcome, checkout, response, followup, review_request
    """
    result = await ai_concierge.draft_guest_message(
        message_type=request.message_type,
        guest_name=request.guest_name,
        property_name=request.property_name,
        details=request.details,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "AI service error"))

    return result


@router.post("/respond-to-review")
async def respond_to_review(request: ReviewResponseRequest):
    """
    Generate a response to a guest review.
    Adapts tone based on rating (positive/negative).
    """
    if not 1 <= request.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    result = await ai_concierge.respond_to_review(
        review_text=request.review_text,
        rating=request.rating,
        guest_name=request.guest_name,
        property_name=request.property_name,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "AI service error"))

    return result


@router.post("/generate-description")
async def generate_property_description(request: PropertyDescriptionRequest):
    """
    Generate a property listing description.
    Styles: professional, casual, luxury
    """
    result = await ai_concierge.generate_property_description(
        property_data=request.property_data,
        style=request.style,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "AI service error"))

    return result


@router.post("/analyze-sentiment")
async def analyze_message_sentiment(request: SentimentRequest):
    """
    Analyze the sentiment of a message.
    Returns sentiment, urgency, topics, and recommended action.
    """
    result = await ai_concierge.analyze_sentiment(request.text)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "AI service error"))

    return result


# Voice Service Endpoints
@router.post("/tts")
async def text_to_speech(request: TextToSpeechRequest):
    """
    Convert text to speech audio.
    Returns base64-encoded audio data.
    """
    result = await voice_service.text_to_speech(
        text=request.text,
        voice_id=request.voice,
        voice_preset=request.preset,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Voice service error"))

    return result


@router.post("/voice/welcome")
async def generate_welcome_voice(request: WelcomeMessageRequest):
    """
    Generate a voice welcome message for guests.
    Optionally includes the door code (spoken digit by digit).
    """
    result = await voice_service.generate_welcome_message(
        guest_name=request.guest_name,
        property_name=request.property_name,
        check_in_code=request.check_in_code,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Voice service error"))

    return result


@router.post("/voice/checkout")
async def generate_checkout_voice(request: CheckoutReminderRequest):
    """
    Generate a voice checkout reminder.
    """
    result = await voice_service.generate_checkout_reminder(
        guest_name=request.guest_name,
        checkout_time=request.checkout_time,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Voice service error"))

    return result


@router.get("/voice/ivr")
async def get_ivr_greeting():
    """
    Get the IVR greeting audio for phone system.
    """
    result = await voice_service.generate_ivr_greeting()

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Voice service error"))

    return result


@router.get("/voices")
async def list_available_voices():
    """
    List all available ElevenLabs voices.
    """
    result = await voice_service.list_voices()

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Voice service error"))

    return result


@router.get("/voices/{voice_id}")
async def get_voice_details(voice_id: str):
    """
    Get details about a specific voice.
    Can use voice key (concierge, friendly, etc.) or actual voice ID.
    """
    result = await voice_service.get_voice_info(voice_id)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Voice service error"))

    return result


# Combined AI Actions
@router.post("/auto-respond")
async def auto_respond_with_voice(
    request: GuestQuestionRequest,
    background_tasks: BackgroundTasks,
    include_voice: bool = False,
):
    """
    Generate an AI response and optionally create voice audio.
    Useful for automated guest messaging with voice option.
    """
    # Get text response
    chat_result = await ai_concierge.answer_guest_question(
        question=request.question,
        conversation_history=[{"role": m.role, "content": m.content} for m in request.conversation_history] if request.conversation_history else None,
    )

    if not chat_result["success"]:
        raise HTTPException(status_code=500, detail=chat_result.get("error", "AI service error"))

    response = {
        "text_response": chat_result,
    }

    # Generate voice if requested
    if include_voice and chat_result.get("response"):
        voice_result = await voice_service.text_to_speech(
            text=chat_result["response"],
            voice_preset="warm",
        )
        if voice_result["success"]:
            response["voice_response"] = voice_result

    return response
