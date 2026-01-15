"""
Right at Home BnB - AI Concierge Service
GPT-4 powered guest messaging and property management AI
@author ECHO OMEGA PRIME
"""

import os
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger
import httpx
from openai import AsyncOpenAI

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# System prompts for different contexts
SYSTEM_PROMPTS = {
    "guest_message": """You are the AI concierge for Right at Home BnB, a premium short-term rental company in Midland, Texas, operated by Steven Palma.

Your personality:
- Warm, professional, and genuinely helpful
- Texas hospitality with a touch of elegance
- Knowledgeable about Midland and the Permian Basin area

Your responsibilities:
- Answer guest questions promptly and thoroughly
- Provide check-in/check-out information
- Share local recommendations (restaurants, attractions, services)
- Handle maintenance requests professionally
- Escalate urgent issues to Steven when necessary

Guidelines:
- Always be polite and use the guest's name when known
- Keep responses concise but complete
- Offer additional help proactively
- For emergencies, provide the emergency contact number
- Never share other guest information or property codes

Local Knowledge - Midland, TX:
- Best restaurants: Cork & Pig Tavern, Venezia, Wall Street Bar & Grill
- Attractions: Permian Basin Petroleum Museum, Wagner Noel PAC, I-20 Wildlife Preserve
- Grocery: HEB, Market Street, United
- Emergency: 911 | Non-emergency: (432) 685-7108
""",

    "message_draft": """You are an AI assistant helping a property manager draft guest messages.
Create professional, friendly messages that maintain the brand voice of a premium BnB.
Keep messages concise but warm. Use the guest's name when provided.
Sign messages as "Right at Home BnB Team" unless instructed otherwise.""",

    "review_response": """You are helping respond to guest reviews for Right at Home BnB.
For positive reviews: Express genuine gratitude, mention specific feedback, invite them back.
For negative reviews: Apologize sincerely, address concerns professionally, offer to make it right.
Keep responses authentic and avoid generic templates. Maintain dignity even with unfair criticism.""",

    "property_description": """You are a copywriter creating property descriptions for short-term rentals.
Write engaging, accurate descriptions that highlight:
- Key amenities and features
- Location benefits
- Unique selling points
- Target guest appeal (families, business travelers, couples)
Keep descriptions SEO-friendly with relevant keywords for Midland, Texas area.""",
}


class AIConcierge:
    """AI-powered concierge for guest interactions and property management."""

    def __init__(self):
        self.model = os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview")
        self.temperature = 0.7
        self.max_tokens = 1000

    async def generate_response(
        self,
        prompt: str,
        context_type: str = "guest_message",
        context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Generate an AI response based on the given prompt and context.

        Args:
            prompt: The user's message or question
            context_type: Type of interaction (guest_message, message_draft, etc.)
            context: Additional context (guest info, property info, etc.)
            conversation_history: Previous messages in the conversation

        Returns:
            Dict with response text, tokens used, and metadata
        """
        try:
            # Build system prompt with context
            system_prompt = SYSTEM_PROMPTS.get(context_type, SYSTEM_PROMPTS["guest_message"])

            if context:
                system_prompt += f"\n\nCurrent Context:\n{json.dumps(context, indent=2)}"

            # Build messages array
            messages = [{"role": "system", "content": system_prompt}]

            if conversation_history:
                messages.extend(conversation_history)

            messages.append({"role": "user", "content": prompt})

            # Call OpenAI API
            response = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )

            return {
                "success": True,
                "response": response.choices[0].message.content,
                "tokens_used": {
                    "prompt": response.usage.prompt_tokens,
                    "completion": response.usage.completion_tokens,
                    "total": response.usage.total_tokens,
                },
                "model": self.model,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"AI Concierge error: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def draft_guest_message(
        self,
        message_type: str,
        guest_name: str,
        property_name: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Draft a guest message based on type and context.

        Args:
            message_type: Type of message (welcome, checkout, response, etc.)
            guest_name: Guest's name
            property_name: Property name
            details: Additional details (check-in time, special requests, etc.)
        """
        prompts = {
            "welcome": f"Draft a warm welcome message for {guest_name} who is checking into {property_name}.",
            "checkout": f"Draft a checkout reminder for {guest_name} at {property_name}.",
            "response": f"Draft a response to {guest_name}'s inquiry at {property_name}.",
            "followup": f"Draft a post-stay follow-up message for {guest_name} who stayed at {property_name}.",
            "review_request": f"Draft a polite review request for {guest_name} after their stay at {property_name}.",
        }

        prompt = prompts.get(message_type, prompts["response"])

        if details:
            prompt += f"\n\nDetails: {json.dumps(details)}"

        return await self.generate_response(
            prompt=prompt,
            context_type="message_draft",
            context={
                "guest_name": guest_name,
                "property_name": property_name,
                "message_type": message_type,
            },
        )

    async def respond_to_review(
        self,
        review_text: str,
        rating: int,
        guest_name: str,
        property_name: str,
    ) -> Dict[str, Any]:
        """Generate a response to a guest review."""
        sentiment = "positive" if rating >= 4 else "mixed" if rating == 3 else "negative"

        prompt = f"""Please write a response to this {sentiment} review:

Guest: {guest_name}
Property: {property_name}
Rating: {rating}/5

Review:
"{review_text}"
"""
        return await self.generate_response(
            prompt=prompt,
            context_type="review_response",
        )

    async def generate_property_description(
        self,
        property_data: Dict[str, Any],
        style: str = "professional",
    ) -> Dict[str, Any]:
        """Generate a property listing description."""
        prompt = f"""Create a compelling property description in a {style} style:

Property Details:
{json.dumps(property_data, indent=2)}

Include:
1. Catchy headline
2. Engaging description (2-3 paragraphs)
3. Key amenities bullet points
4. Location highlights
"""
        return await self.generate_response(
            prompt=prompt,
            context_type="property_description",
        )

    async def answer_guest_question(
        self,
        question: str,
        guest_context: Optional[Dict[str, Any]] = None,
        property_context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Answer a guest question with full context."""
        context = {}
        if guest_context:
            context["guest"] = guest_context
        if property_context:
            context["property"] = property_context

        return await self.generate_response(
            prompt=question,
            context_type="guest_message",
            context=context if context else None,
            conversation_history=conversation_history,
        )

    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze the sentiment of a message."""
        prompt = f"""Analyze the sentiment of this message and provide:
1. Overall sentiment (positive, neutral, negative)
2. Urgency level (low, medium, high, critical)
3. Key topics mentioned
4. Recommended action

Message: "{text}"

Respond in JSON format."""

        result = await self.generate_response(
            prompt=prompt,
            context_type="guest_message",
        )

        if result["success"]:
            try:
                # Try to parse the JSON response
                analysis = json.loads(result["response"])
                result["analysis"] = analysis
            except json.JSONDecodeError:
                result["analysis"] = {"raw": result["response"]}

        return result


# Singleton instance
ai_concierge = AIConcierge()


# Utility functions
async def quick_response(question: str) -> str:
    """Quick helper to get an AI response."""
    result = await ai_concierge.answer_guest_question(question)
    return result.get("response", "I apologize, I couldn't process that request.")


async def draft_message(message_type: str, guest: str, property: str) -> str:
    """Quick helper to draft a message."""
    result = await ai_concierge.draft_guest_message(message_type, guest, property)
    return result.get("response", "")
