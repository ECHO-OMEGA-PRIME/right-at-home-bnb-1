"""
Right At Home BnB - Steven AI API Routes
==========================================
API endpoints for the Steven AI Concierge with:
- Claude CLI OAuth subprocess intelligence
- Firebase infinite memory
- Full conversation history access

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger

from services.steven_ai import steven_ai, ask_steven, get_guest_history

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class ChatRequest(BaseModel):
    """Request to chat with Steven AI."""
    message: str = Field(..., description="Guest's message to Steven")
    guest_phone: Optional[str] = Field(None, description="Guest phone number (for identification)")
    guest_email: Optional[str] = Field(None, description="Guest email (for identification)")
    guest_name: Optional[str] = Field(None, description="Guest's name")
    property_name: Optional[str] = Field(None, description="Property name if known")
    booking_id: Optional[str] = Field(None, description="Booking ID if applicable")


class ChatResponse(BaseModel):
    """Response from Steven AI."""
    success: bool
    response: str
    steven_says: str
    guest_id: Optional[str] = None
    memories_recalled: int = 0
    is_returning_guest: bool = False
    ai_engine: str = "claude_cli_oauth"
    timestamp: str


class ConversationHistoryResponse(BaseModel):
    """Guest conversation history."""
    guest_id: str
    conversations: List[Dict[str, Any]]
    total_interactions: int


class AllConversationsResponse(BaseModel):
    """All recent conversations (dashboard view)."""
    conversations: List[Dict[str, Any]]
    total: int


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/chat", response_model=ChatResponse)
async def chat_with_steven(request: ChatRequest):
    """
    Chat with Steven AI Concierge.

    Steven uses Claude CLI OAuth subprocess for intelligence and
    Firebase for infinite memory - he remembers ALL conversations.
    """
    try:
        guest_identifier = request.guest_phone or request.guest_email or "anonymous"

        result = await steven_ai.chat(
            message=request.message,
            guest_identifier=guest_identifier,
            guest_name=request.guest_name,
            property_name=request.property_name,
            booking_id=request.booking_id
        )

        return ChatResponse(**result)

    except Exception as e:
        logger.error(f"Steven chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def steven_status():
    """Check Steven AI status and capabilities."""
    return {
        "name": "Steven",
        "status": "online",
        "claude_subprocess_available": steven_ai.claude_available,
        "firebase_memory_available": steven_ai.firebase_available,
        "infinite_memory": steven_ai.firebase_available,
        "properties_known": 22,
        "version": "1.0.0",
        "capabilities": [
            "Guest messaging with full context",
            "Property and booking information",
            "Local recommendations (Midland, TX)",
            "Smart lock code generation",
            "Cleaner scheduling",
            "Maintenance request handling",
            "Review response drafting",
            "Infinite conversation memory"
        ],
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/history/{guest_identifier}")
async def get_conversation_history(guest_identifier: str, limit: int = 50):
    """
    Get full conversation history for a guest.

    Steven remembers EVERY conversation - infinite memory via Firebase.
    """
    try:
        conversations = await steven_ai.get_conversation_history(guest_identifier, limit)
        guest_id = steven_ai._get_guest_id(guest_identifier)

        return ConversationHistoryResponse(
            guest_id=guest_id,
            conversations=conversations,
            total_interactions=len(conversations)
        )

    except Exception as e:
        logger.error(f"History retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations")
async def get_all_conversations(limit: int = 100):
    """
    Get all recent conversations across all guests.

    Used for dashboard monitoring and analytics.
    """
    try:
        conversations = await steven_ai.get_all_conversations(limit)

        return AllConversationsResponse(
            conversations=conversations,
            total=len(conversations)
        )

    except Exception as e:
        logger.error(f"All conversations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick")
async def quick_ask(message: str, guest_name: Optional[str] = None):
    """Quick endpoint to ask Steven a question (anonymous)."""
    try:
        response = await ask_steven(
            message=message,
            guest_name=guest_name
        )
        return {"response": response, "from": "Steven"}

    except Exception as e:
        logger.error(f"Quick ask error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/knowledge")
async def get_business_knowledge():
    """Get Steven's full business knowledge base."""
    return {
        "business": "Right At Home BnB",
        "owner": "Steven Palma",
        "location": "Midland, TX",
        "properties_count": 22,
        "property_tiers": {
            "premium": 3,
            "standard": 7,
            "economy": 12
        },
        "cleaners": 5,
        "ai_concierge": "Steven",
        "features": [
            "22 properties in Midland, TX",
            "Full local area knowledge",
            "Smart lock integration (Schlage, Yale, August)",
            "Cleaner team management",
            "Guest CRM with infinite memory",
            "AI-powered messaging"
        ],
        "emergency_contacts": {
            "owner": "(432) 555-0100",
            "after_hours": "(432) 555-0911",
            "maintenance": "(432) 555-0200"
        }
    }


@router.post("/draft-message")
async def draft_message(
    message_type: str,
    guest_name: str,
    property_name: str,
    details: Optional[Dict[str, Any]] = None
):
    """
    Have Steven draft a guest message.

    Types: welcome, checkout, response, followup, review_request
    """
    try:
        prompt = f"Draft a {message_type} message for {guest_name} at {property_name}."
        if details:
            prompt += f" Details: {details}"

        result = await steven_ai.chat(
            message=prompt,
            guest_identifier=f"draft_{guest_name}",
            guest_name=guest_name,
            property_name=property_name
        )

        return {
            "message_type": message_type,
            "draft": result.get("response"),
            "guest_name": guest_name,
            "property_name": property_name
        }

    except Exception as e:
        logger.error(f"Draft message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
