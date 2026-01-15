"""
Right at Home BnB - Voice Service
==================================
Complete voice integration for the AI Concierge:
- ElevenLabs TTS for natural speech synthesis
- OpenAI Whisper STT for speech recognition
- Consistent voice personality for brand
- Multi-language support

@author ECHO OMEGA PRIME
@owner Steven Palma - Right at Home BnB, Midland, TX
"""

import os
import io
import base64
import tempfile
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from pathlib import Path
import httpx
from loguru import logger
from openai import AsyncOpenAI

# Initialize clients
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ElevenLabs Configuration
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

# Voice Configuration for Right at Home BnB
VOICE_CONFIG = {
    # Primary concierge voice - warm, professional female
    "concierge": {
        "voice_id": "21m00Tcm4TlvDq8ikWAM",  # Rachel - Professional, warm
        "name": "Rachel",
        "description": "Primary concierge voice - warm and professional"
    },
    # Alternative male voice
    "concierge_male": {
        "voice_id": "VR6AewLTigWG4xSOukaG",  # Arnold - Professional male
        "name": "Arnold",
        "description": "Male alternative for concierge"
    },
    # Friendly casual voice for notifications
    "friendly": {
        "voice_id": "EXAVITQu4vr4xnSDxMaL",  # Bella - Friendly, casual
        "name": "Bella",
        "description": "Casual and friendly for quick messages"
    },
    # Texas accent option for local flavor
    "texas": {
        "voice_id": "TxGEqnHWrfWFTfGW9XjX",  # Josh - Southern accent
        "name": "Josh",
        "description": "Texas/Southern accent for local hospitality"
    },
    # Steven's voice clone (if available)
    "steven": {
        "voice_id": os.getenv("ELEVENLABS_STEVEN_VOICE_ID", ""),
        "name": "Steven",
        "description": "Steven Palma's voice clone for personal messages"
    }
}

# Voice settings presets
VOICE_PRESETS = {
    "professional": {
        "stability": 0.75,
        "similarity_boost": 0.75,
        "style": 0.0,
        "use_speaker_boost": True
    },
    "warm": {
        "stability": 0.50,
        "similarity_boost": 0.75,
        "style": 0.30,
        "use_speaker_boost": True
    },
    "friendly": {
        "stability": 0.35,
        "similarity_boost": 0.80,
        "style": 0.50,
        "use_speaker_boost": True
    },
    "excited": {
        "stability": 0.25,
        "similarity_boost": 0.85,
        "style": 0.70,
        "use_speaker_boost": True
    }
}


class VoiceService:
    """
    Complete voice service for Right at Home BnB.
    Integrates ElevenLabs TTS and OpenAI Whisper STT.
    """

    def __init__(self):
        self.elevenlabs_api_key = ELEVENLABS_API_KEY
        self.default_voice = "concierge"
        self.default_preset = "warm"
        self.default_model = "eleven_turbo_v2_5"  # Latest fast model
        self.output_format = "mp3_44100_128"

    @property
    def _headers(self) -> Dict[str, str]:
        """ElevenLabs API headers."""
        return {
            "xi-api-key": self.elevenlabs_api_key,
            "Content-Type": "application/json"
        }

    # =========================================================================
    # TEXT-TO-SPEECH (ElevenLabs)
    # =========================================================================

    async def text_to_speech(
        self,
        text: str,
        voice: str = "concierge",
        preset: str = "warm",
        output_format: str = "mp3_44100_128",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert text to speech using ElevenLabs.

        Args:
            text: Text to synthesize
            voice: Voice key from VOICE_CONFIG or voice_id
            preset: Voice preset (professional, warm, friendly, excited)
            output_format: Audio format (mp3_44100_128, mp3_22050_32, etc.)
            model: ElevenLabs model (eleven_turbo_v2_5, eleven_multilingual_v2)

        Returns:
            Dict with audio_base64, duration, metadata
        """
        try:
            if not self.elevenlabs_api_key:
                return {
                    "success": False,
                    "error": "ElevenLabs API key not configured"
                }

            # Resolve voice ID
            voice_id = self._resolve_voice_id(voice)
            if not voice_id:
                return {
                    "success": False,
                    "error": f"Unknown voice: {voice}"
                }

            # Get voice settings
            settings = VOICE_PRESETS.get(preset, VOICE_PRESETS["warm"])
            model = model or self.default_model

            # Build request
            url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{voice_id}/stream"
            payload = {
                "text": text,
                "model_id": model,
                "voice_settings": settings
            }
            params = {"output_format": output_format}

            # Make request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=self._headers,
                    json=payload,
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                audio_data = response.content

            # Estimate duration (rough: ~150 words/minute)
            word_count = len(text.split())
            duration_estimate = (word_count / 150) * 60

            return {
                "success": True,
                "audio_base64": base64.b64encode(audio_data).decode("utf-8"),
                "audio_bytes": len(audio_data),
                "format": output_format,
                "duration_seconds": duration_estimate,
                "voice": voice,
                "voice_id": voice_id,
                "model": model,
                "timestamp": datetime.utcnow().isoformat()
            }

        except httpx.HTTPStatusError as e:
            logger.error(f"ElevenLabs API error: {e.response.status_code}")
            return {
                "success": False,
                "error": f"ElevenLabs API error: {e.response.status_code}",
                "details": e.response.text
            }
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def _resolve_voice_id(self, voice: str) -> Optional[str]:
        """Resolve voice key to voice ID."""
        if voice in VOICE_CONFIG:
            return VOICE_CONFIG[voice]["voice_id"]
        # Assume it's already a voice ID
        if len(voice) > 10:
            return voice
        return None

    # =========================================================================
    # SPEECH-TO-TEXT (OpenAI Whisper)
    # =========================================================================

    async def speech_to_text(
        self,
        audio_data: Union[bytes, str],
        language: str = "en",
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert speech to text using OpenAI Whisper.

        Args:
            audio_data: Audio bytes or base64 string
            language: Language code (en, es, etc.)
            prompt: Optional prompt to guide transcription

        Returns:
            Dict with transcription text and metadata
        """
        try:
            # Handle base64 input
            if isinstance(audio_data, str):
                audio_data = base64.b64decode(audio_data)

            # Write to temp file (Whisper needs file)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                f.write(audio_data)
                temp_path = f.name

            try:
                # Call Whisper API
                with open(temp_path, "rb") as audio_file:
                    response = await openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language=language,
                        prompt=prompt or "Right at Home BnB, Midland Texas, Steven Palma"
                    )

                return {
                    "success": True,
                    "text": response.text,
                    "language": language,
                    "timestamp": datetime.utcnow().isoformat()
                }
            finally:
                # Clean up temp file
                Path(temp_path).unlink(missing_ok=True)

        except Exception as e:
            logger.error(f"STT error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # =========================================================================
    # PRE-BUILT MESSAGE TEMPLATES
    # =========================================================================

    async def generate_welcome_message(
        self,
        guest_name: str,
        property_name: str,
        door_code: Optional[str] = None,
        wifi_info: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Generate welcome audio message for guest."""
        # Build script
        parts = [
            f"Welcome to {property_name}, {guest_name}!",
            "We're so glad you're here.",
            "Steven and the Right at Home team hope you have an amazing stay."
        ]

        if door_code:
            # Speak code digit by digit
            code_spoken = " ".join(door_code)
            parts.append(f"Your door code is {code_spoken}.")

        if wifi_info:
            parts.append(f"Your WiFi network is {wifi_info.get('name', 'RightAtHome')}.")
            parts.append(f"The password is {wifi_info.get('password', 'Welcome2Midland')}.")

        parts.extend([
            "If you need anything at all, just send us a message through the app.",
            "Welcome home!"
        ])

        script = " ".join(parts)

        return await self.text_to_speech(
            text=script,
            voice="concierge",
            preset="warm"
        )

    async def generate_checkout_reminder(
        self,
        guest_name: str,
        checkout_time: str = "11:00 AM"
    ) -> Dict[str, Any]:
        """Generate checkout reminder audio."""
        script = f"""
Hi {guest_name}, this is a friendly reminder that checkout is at {checkout_time}.

Please make sure to:
Leave all keys and remotes where you found them.
Take all your belongings.
Start the dishwasher if you haven't already.
Take out the trash to the bins.
Close and lock all doors and windows.

Thank you for staying with us at Right at Home!
We hope to see you again soon.
Safe travels!
"""
        return await self.text_to_speech(
            text=script.strip(),
            voice="concierge",
            preset="friendly"
        )

    async def generate_problem_acknowledgment(
        self,
        guest_name: str,
        issue: str
    ) -> Dict[str, Any]:
        """Generate acknowledgment of reported issue."""
        script = f"""
Hi {guest_name}, thank you for letting us know about the {issue}.

Steven has been notified and will address this as quickly as possible.
If this is urgent, you can reach Steven directly at 4 3 2, 5 5 9, 1 9 0 4.

We apologize for any inconvenience and appreciate your patience.
"""
        return await self.text_to_speech(
            text=script.strip(),
            voice="concierge",
            preset="professional"
        )

    async def generate_ivr_greeting(self) -> Dict[str, Any]:
        """Generate IVR greeting for phone system."""
        script = """
Thank you for calling Right at Home BnB.

For reservations, press 1.
For guest services, press 2.
To speak with property management, press 3.
For emergencies, press 0.

You can also reach us anytime through our website or the Airbnb app.
"""
        return await self.text_to_speech(
            text=script.strip(),
            voice="concierge",
            preset="professional"
        )

    async def generate_directions_audio(
        self,
        destination: str,
        steps: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Generate audio directions."""
        parts = [f"Here are directions to {destination}."]

        for i, step in enumerate(steps[:10], 1):  # Limit to 10 steps
            instruction = step.get("instruction", "")
            distance = step.get("distance", "")
            parts.append(f"Step {i}: {instruction}. {distance}.")

        parts.append("You have arrived at your destination.")
        script = " ".join(parts)

        return await self.text_to_speech(
            text=script,
            voice="concierge",
            preset="professional"
        )

    # =========================================================================
    # VOICE MANAGEMENT
    # =========================================================================

    async def list_voices(self) -> Dict[str, Any]:
        """List available ElevenLabs voices."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ELEVENLABS_BASE_URL}/voices",
                    headers=self._headers
                )
                response.raise_for_status()
                data = response.json()

            return {
                "success": True,
                "voices": data.get("voices", []),
                "configured_voices": VOICE_CONFIG,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error listing voices: {e}")
            return {
                "success": False,
                "error": str(e),
                "configured_voices": VOICE_CONFIG
            }

    async def get_voice_info(self, voice: str) -> Dict[str, Any]:
        """Get information about a specific voice."""
        try:
            voice_id = self._resolve_voice_id(voice)
            if not voice_id:
                return {"success": False, "error": f"Unknown voice: {voice}"}

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ELEVENLABS_BASE_URL}/voices/{voice_id}",
                    headers=self._headers
                )
                response.raise_for_status()

            return {
                "success": True,
                "voice": response.json(),
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting voice info: {e}")
            return {"success": False, "error": str(e)}

    async def get_usage(self) -> Dict[str, Any]:
        """Get ElevenLabs usage statistics."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{ELEVENLABS_BASE_URL}/user/subscription",
                    headers=self._headers
                )
                response.raise_for_status()
                data = response.json()

            return {
                "success": True,
                "character_count": data.get("character_count", 0),
                "character_limit": data.get("character_limit", 0),
                "tier": data.get("tier", "unknown"),
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting usage: {e}")
            return {"success": False, "error": str(e)}

    # =========================================================================
    # FILE UTILITIES
    # =========================================================================

    async def save_audio(
        self,
        audio_base64: str,
        file_path: Union[str, Path]
    ) -> bool:
        """Save base64 audio to file."""
        try:
            audio_bytes = base64.b64decode(audio_base64)
            Path(file_path).write_bytes(audio_bytes)
            logger.info(f"Audio saved to {file_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving audio: {e}")
            return False

    def get_audio_url(self, audio_base64: str, format: str = "mp3") -> str:
        """Generate a data URL from base64 audio."""
        return f"data:audio/{format};base64,{audio_base64}"


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

voice_service = VoiceService()


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def speak(text: str, voice: str = "concierge") -> bytes:
    """Quick helper to generate speech and return audio bytes."""
    result = await voice_service.text_to_speech(text, voice=voice)
    if result["success"]:
        return base64.b64decode(result["audio_base64"])
    return b""


async def transcribe(audio_data: Union[bytes, str]) -> str:
    """Quick helper to transcribe audio to text."""
    result = await voice_service.speech_to_text(audio_data)
    return result.get("text", "")


async def welcome_audio(guest_name: str, property_name: str, door_code: str = None) -> bytes:
    """Generate welcome message audio."""
    result = await voice_service.generate_welcome_message(
        guest_name=guest_name,
        property_name=property_name,
        door_code=door_code
    )
    if result["success"]:
        return base64.b64decode(result["audio_base64"])
    return b""
