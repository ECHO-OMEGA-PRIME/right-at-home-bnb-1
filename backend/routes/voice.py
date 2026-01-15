"""
Right At Home BnB - Voice API Routes (Twilio)
==============================================
Inbound guest calls and outbound operational calls.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, Form, Request, Response
from typing import Optional
from pydantic import BaseModel

from services.twilio_voice import twilio_voice_service, CallType

router = APIRouter()


class CallStevenRequest(BaseModel):
    message: str
    call_type: str = "steven_escalation"


class CallCleanerRequest(BaseModel):
    cleaner_phone: str
    cleaner_name: str
    message: str
    property_address: Optional[str] = None


class SMSRequest(BaseModel):
    to_phone: str
    message: str


class BriefingDeliveryRequest(BaseModel):
    briefing_script: str


# =========================================================================
# TWILIO WEBHOOKS (Inbound Calls)
# =========================================================================

@router.post("/inbound")
async def handle_inbound_call(
    request: Request,
    From: str = Form(default=None),
    CallSid: str = Form(default=None)
):
    """Handle inbound guest call - returns TwiML."""
    twiml = twilio_voice_service.generate_inbound_twiml(From)
    return Response(content=twiml, media_type="application/xml")


@router.post("/process-speech")
async def process_speech(
    SpeechResult: str = Form(...),
    From: str = Form(default=None),
    CallSid: str = Form(default=None)
):
    """Process guest speech and determine response."""
    result = await twilio_voice_service.process_guest_speech(
        SpeechResult, From, CallSid
    )

    # Generate TwiML based on result
    if result.get("action") == "transfer":
        twiml = f"""
        <Response>
            <Say voice="Polly.Matthew">{result['response_text']}</Say>
            <Dial>{result['transfer_to']}</Dial>
        </Response>
        """
    elif result.get("action") == "escalate":
        twiml = f"""
        <Response>
            <Say voice="Polly.Matthew">{result['response_text']}</Say>
            <Gather input="speech" action="/api/voice/process-speech" timeout="5">
                <Say voice="Polly.Matthew">Please tell me more about the issue.</Say>
            </Gather>
        </Response>
        """
    else:
        twiml = f"""
        <Response>
            <Say voice="Polly.Matthew">{result['response_text']}</Say>
            <Gather input="speech" action="/api/voice/process-speech" timeout="5">
                <Say voice="Polly.Matthew">Is there anything else I can help you with?</Say>
            </Gather>
            <Say voice="Polly.Matthew">Thank you for staying with Right At Home. Goodbye!</Say>
        </Response>
        """

    return Response(content=twiml, media_type="application/xml")


@router.post("/no-input")
async def handle_no_input():
    """Handle when guest doesn't provide input."""
    twiml = """
    <Response>
        <Say voice="Polly.Matthew">
            I didn't catch that. Please describe what you need help with,
            or press 0 to speak with Steven directly.
        </Say>
        <Gather input="speech dtmf" action="/api/voice/process-speech" timeout="5">
        </Gather>
        <Say voice="Polly.Matthew">
            I'm sorry, I still couldn't hear you. I'll connect you to Steven now.
        </Say>
        <Dial>+14329006300</Dial>
    </Response>
    """
    return Response(content=twiml, media_type="application/xml")


@router.post("/steven-response")
async def handle_steven_response(Digits: str = Form(default=None)):
    """Handle Steven's response to an alert call."""
    if Digits == "1":
        # Connect to guest
        twiml = """
        <Response>
            <Say voice="Polly.Matthew">Connecting you to the guest now.</Say>
            <Dial>/api/voice/connect-guest</Dial>
        </Response>
        """
    elif Digits == "2":
        twiml = """
        <Response>
            <Say voice="Polly.Matthew">Alert acknowledged. Thank you Steven.</Say>
        </Response>
        """
    elif Digits == "9":
        twiml = """
        <Response>
            <Say voice="Polly.Matthew">Repeating the message...</Say>
            <Redirect>/api/voice/repeat-alert</Redirect>
        </Response>
        """
    else:
        twiml = """
        <Response>
            <Say voice="Polly.Matthew">Invalid option. Press 1 for guest, 2 to acknowledge.</Say>
            <Gather numDigits="1" action="/api/voice/steven-response"></Gather>
        </Response>
        """
    return Response(content=twiml, media_type="application/xml")


@router.post("/cleaner-response")
async def handle_cleaner_response(Digits: str = Form(default=None)):
    """Handle cleaner's response to a reminder call."""
    if Digits == "1":
        twiml = """
        <Response>
            <Say voice="Polly.Matthew">Thank you for confirming. Have a great day!</Say>
        </Response>
        """
    elif Digits == "2":
        twiml = """
        <Response>
            <Say voice="Polly.Matthew">Connecting you to Steven now.</Say>
            <Dial>+14329006300</Dial>
        </Response>
        """
    else:
        twiml = """
        <Response>
            <Say voice="Polly.Matthew">Press 1 to confirm or 2 to speak with Steven.</Say>
            <Gather numDigits="1" action="/api/voice/cleaner-response"></Gather>
        </Response>
        """
    return Response(content=twiml, media_type="application/xml")


@router.post("/call-status")
async def handle_call_status(
    CallSid: str = Form(default=None),
    CallStatus: str = Form(default=None)
):
    """Handle call status updates from Twilio."""
    # Log status update
    return {"status": "received", "call_sid": CallSid, "call_status": CallStatus}


# =========================================================================
# OUTBOUND CALLS (API Endpoints)
# =========================================================================

@router.post("/call-steven")
async def call_steven(request: CallStevenRequest):
    """Initiate a call to Steven."""
    try:
        call_type = CallType(request.call_type)
    except ValueError:
        call_type = CallType.STEVEN_ESCALATION

    return await twilio_voice_service.call_steven(request.message, call_type)


@router.post("/call-cleaner")
async def call_cleaner(request: CallCleanerRequest):
    """Call a cleaner with a reminder."""
    return await twilio_voice_service.call_cleaner(
        cleaner_phone=request.cleaner_phone,
        cleaner_name=request.cleaner_name,
        message=request.message,
        property_address=request.property_address
    )


@router.post("/deliver-briefing")
async def deliver_briefing_call(request: BriefingDeliveryRequest):
    """Deliver daily briefing via voice call."""
    return await twilio_voice_service.deliver_daily_briefing_call(request.briefing_script)


@router.post("/sms")
async def send_sms(request: SMSRequest):
    """Send an SMS message."""
    return await twilio_voice_service.send_sms(request.to_phone, request.message)


# =========================================================================
# CALL HISTORY
# =========================================================================

@router.get("/history")
async def get_call_history(
    call_type: Optional[str] = None,
    limit: int = 50
):
    """Get call history."""
    ct = CallType(call_type) if call_type else None
    return await twilio_voice_service.get_call_history(ct, limit)


@router.get("/unresolved")
async def get_unresolved_calls():
    """Get unresolved guest calls."""
    return await twilio_voice_service.get_unresolved_calls()
