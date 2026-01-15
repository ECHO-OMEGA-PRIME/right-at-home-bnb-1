"""
Right at Home BnB - Voice Service
ElevenLabs TTS for voice messages and IVR
@author ECHO OMEGA PRIME
"""

import os
import io
import base64
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path
import httpx
from loguru import logger

# ElevenLabs Configuration
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

# Voice IDs for different personas
VOICE_IDS = {
    # Professional female voice for guest interactions
    "concierge": "21m00Tcm4TlvDq8ikWAM",  # Rachel - Professional, warm
    # Professional male voice alternative
    "concierge_male": "VR6AewLTigWG4xSOukaG",  # Arnold - Professional
    # Friendly, casual voice for notifications
    "friendly": "EXAVITQu4vr4xnSDxMaL",  # Bella - Friendly, casual
    # Texas accent option
    "texas": "TxGEqnHWrfWFTfGW9XjX",  # Josh - Southern accent
}

# Voice settings presets
VOICE_SETTINGS = {
    "professional": {
        "stability": 0.75,
        "similarity_boost": 0.75,
        "style": 0.0,
        "use_speaker_boost": True,
    },
    "warm": {
        "stability": 0.50,
        "similarity_boost": 0.75,
        "style": 0.30,
        "use_speaker_boost": True,
    },
    "friendly": {
        "stability": 0.35,
        "similarity_boost": 0.80,
        "style": 0.50,
        "use_speaker_boost": True,
    },
}


class VoiceService:
    """ElevenLabs voice synthesis service for Right at Home BnB."""

    def __init__(self):
        self.api_key = ELEVENLABS_API_KEY
        self.base_url = ELEVENLABS_BASE_URL
        self.default_model = "eleven_turbo_v2"  # Fast, high quality
        self.default_voice = VOICE_IDS["concierge"]

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        voice_preset: str = "professional",
        output_format: str = "mp3_44100_128",
        optimize_latency: bool = True,
    ) -> Dict[str, Any]:
        """
        Convert text to speech audio.

        Args:
            text: Text to synthesize
            voice_id: ElevenLabs voice ID (or key from VOICE_IDS)
            voice_preset: Voice settings preset (professional, warm, friendly)
            output_format: Audio format (mp3_44100_128, mp3_22050_32, etc.)
            optimize_latency: Use streaming optimization

        Returns:
            Dict with audio data (base64), duration estimate, and metadata
        """
        try:
            # Resolve voice ID
            if voice_id and voice_id in VOICE_IDS:
                voice_id = VOICE_IDS[voice_id]
            voice_id = voice_id or self.default_voice

            # Get voice settings
            settings = VOICE_SETTINGS.get(voice_preset, VOICE_SETTINGS["professional"])

            # Prepare request
            url = f"{self.base_url}/text-to-speech/{voice_id}"
            if optimize_latency:
                url += "/stream"

            payload = {
                "text": text,
                "model_id": self.default_model,
                "voice_settings": settings,
            }

            params = {"output_format": output_format}

            # Make request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=self.headers,
                    json=payload,
                    params=params,
                    timeout=30.0,
                )
                response.raise_for_status()

                # Get audio data
                audio_data = response.content

            # Calculate approximate duration (rough estimate: 150 words/minute)
            word_count = len(text.split())
            duration_estimate = (word_count / 150) * 60  # in seconds

            return {
                "success": True,
                "audio_base64": base64.b64encode(audio_data).decode("utf-8"),
                "audio_size": len(audio_data),
                "format": output_format,
                "duration_estimate": duration_estimate,
                "voice_id": voice_id,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except httpx.HTTPStatusError as e:
            logger.error(f"ElevenLabs API error: {e.response.status_code} - {e.response.text}")
            return {
                "success": False,
                "error": f"API error: {e.response.status_code}",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Voice service error: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def generate_welcome_message(
        self,
        guest_name: str,
        property_name: str,
        check_in_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a voice welcome message for guests."""
        script = f"""
Welcome to {property_name}, {guest_name}!

We're so glad you're here. Steven and the Right at Home team hope you have an amazing stay.

{f"Your door code is {' '.join(check_in_code)}." if check_in_code else ""}

If you need anything at all, just send us a message through the app.

Welcome home!
""".strip()

        return await self.text_to_speech(
            text=script,
            voice_preset="warm",
            voice_id="concierge",
        )

    async def generate_checkout_reminder(
        self,
        guest_name: str,
        checkout_time: str,
    ) -> Dict[str, Any]:
        """Generate a voice checkout reminder."""
        script = f"""
Hi {guest_name}, this is a friendly reminder that checkout is at {checkout_time}.

Please make sure to:
- Leave all keys and remotes where you found them
- Take all your belongings
- Close and lock all doors and windows

Thank you for staying with us at Right at Home BnB!
We hope to see you again soon.
""".strip()

        return await self.text_to_speech(
            text=script,
            voice_preset="friendly",
            voice_id="concierge",
        )

    async def generate_ivr_greeting(self) -> Dict[str, Any]:
        """Generate IVR greeting for phone system."""
        script = """
Thank you for calling Right at Home BnB.

For reservations, press 1.
For guest services, press 2.
To speak with property management, press 3.
For emergencies, press 0.

You can also reach us anytime at our website, rightathome dot bnb.
""".strip()

        return await self.text_to_speech(
            text=script,
            voice_preset="professional",
            voice_id="concierge",
        )

    async def list_voices(self) -> Dict[str, Any]:
        """Get list of available voices."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/voices",
                    headers=self.headers,
                )
                response.raise_for_status()
                voices = response.json()

            return {
                "success": True,
                "voices": voices.get("voices", []),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error listing voices: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def get_voice_info(self, voice_id: str) -> Dict[str, Any]:
        """Get information about a specific voice."""
        try:
            if voice_id in VOICE_IDS:
                voice_id = VOICE_IDS[voice_id]

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/voices/{voice_id}",
                    headers=self.headers,
                )
                response.raise_for_status()

            return {
                "success": True,
                "voice": response.json(),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error getting voice info: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def save_audio_file(
        self,
        audio_base64: str,
        file_path: Path,
    ) -> bool:
        """Save base64 audio to file."""
        try:
            audio_data = base64.b64decode(audio_base64)
            file_path.write_bytes(audio_data)
            logger.info(f"Audio saved to {file_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving audio file: {e}")
            return False


# Singleton instance
voice_service = VoiceService()


# Quick utility functions
async def speak(text: str, voice: str = "concierge") -> bytes:
    """Quick function to convert text to speech and return audio bytes."""
    result = await voice_service.text_to_speech(text, voice_id=voice)
    if result["success"]:
        return base64.b64decode(result["audio_base64"])
    return b""


async def welcome_guest(name: str, property: str, code: str = None) -> bytes:
    """Generate welcome message audio."""
    result = await voice_service.generate_welcome_message(name, property, code)
    if result["success"]:
        return base64.b64decode(result["audio_base64"])
    return b""
