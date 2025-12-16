"""Twilio voice webhook endpoints - THE FRONT DOOR."""

import hashlib
from typing import Annotated

from fastapi import APIRouter, Form, Request, Response, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.twiml.voice_response import VoiceResponse, Gather

from src.config import get_settings
from src.services.voice_agent import VoiceAgentService
from src.services.intent_classifier import IntentClassifier
from src.db.database import get_db

router = APIRouter()


def hash_phone(phone: str) -> str:
    """Hash phone number for privacy (SHA-256)."""
    return hashlib.sha256(phone.encode()).hexdigest()[:16]


@router.post("/incoming")
async def handle_incoming_call(
    request: Request,
    From: Annotated[str, Form()] = "",
    CallSid: Annotated[str, Form()] = "",
) -> Response:
    """
    Handle incoming Twilio call - the entry point.
    """
    response = VoiceResponse()
    
    # Single greeting with gather - no duplicate speech
    gather = Gather(
        input="speech",
        action="/api/voice/process",
        method="POST",
        speech_timeout="3",
        timeout=5,
        language="en-US",
    )
    gather.say(
        "Hello, you've reached Bethesda Mission Men's Shelter. "
        "How can I help you today?",
        voice="alice",
        language="en-US",
    )
    response.append(gather)
    
    # If no input, try again once
    response.redirect("/api/voice/no-input")
    
    return Response(content=str(response), media_type="application/xml")


@router.post("/process")
async def process_speech(
    request: Request,
    db: AsyncSession = Depends(get_db),
    SpeechResult: Annotated[str, Form()] = "",
    From: Annotated[str, Form()] = "",
    CallSid: Annotated[str, Form()] = "",
) -> Response:
    """Process speech input from caller."""
    caller_hash = hash_phone(From)
    response = VoiceResponse()
    
    if not SpeechResult:
        response.say("I didn't catch that. Could you please repeat?", voice="alice")
        gather = Gather(
            input="speech",
            action="/api/voice/process",
            method="POST",
            speech_timeout="3",
            timeout=5,
        )
        response.append(gather)
        response.redirect("/api/voice/no-input")
        return Response(content=str(response), media_type="application/xml")
    
    try:
        # Process through voice agent
        voice_agent = VoiceAgentService(db_session=db)
        result = await voice_agent.process_request(
            transcript=SpeechResult,
            caller_hash=caller_hash,
            call_sid=CallSid,
        )
        
        if result.needs_followup:
            # Combine response and followup into single gather
            gather = Gather(
                input="speech",
                action="/api/voice/process",
                method="POST",
                speech_timeout="3",
                timeout=8,
            )
            # Say the response text, then wait for input
            full_response = result.response_text
            if result.followup_prompt:
                full_response += " " + result.followup_prompt
            gather.say(full_response, voice="alice", language="en-US")
            response.append(gather)
            # If no response, end politely
            response.say("No problem. Thank you for calling Bethesda Mission. Take care.", voice="alice")
            response.hangup()
        else:
            response.say(result.response_text, voice="alice", language="en-US")
            response.say("Thank you for calling. Take care and stay safe.", voice="alice")
            response.hangup()
            
    except Exception as e:
        # Don't drop the call on error
        print(f"Error processing speech: {e}")
        response.say(
            "I'm sorry, I'm having trouble right now. "
            "Please try calling back in a few minutes, or visit us directly. "
            "We're located at Bethesda Mission. Take care.",
            voice="alice"
        )
        response.hangup()
    
    return Response(content=str(response), media_type="application/xml")


@router.post("/no-input")
async def handle_no_input() -> Response:
    """Handle case where caller doesn't speak."""
    response = VoiceResponse()
    response.say(
        "I didn't hear anything. If you need immediate help, "
        "please call back or visit us at our location. "
        "We're here for you.",
        voice="alice",
    )
    response.hangup()
    return Response(content=str(response), media_type="application/xml")


@router.post("/transfer")
async def transfer_to_staff() -> Response:
    """Transfer call to on-duty staff (when available)."""
    response = VoiceResponse()
    
    # TODO: Implement actual staff transfer logic
    # For now, provide info and end call
    response.say(
        "I'm connecting you with our staff. "
        "If no one is available, please leave a message or call back during business hours. "
        "Our intake hours are 5 PM to 7 PM daily.",
        voice="alice",
    )
    
    # In production: response.dial(staff_number)
    response.hangup()
    
    return Response(content=str(response), media_type="application/xml")
