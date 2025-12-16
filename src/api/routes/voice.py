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
    
    Flow:
    1. Greet caller with calm, trustworthy voice
    2. Ask how we can help
    3. Gather speech input
    """
    settings = get_settings()
    caller_hash = hash_phone(From)
    
    response = VoiceResponse()
    
    # Warm, calm greeting - NOT corporate
    response.say(
        "Hello, you've reached Bethesda Mission Men's Shelter. "
        "I'm here to help you. How can I assist you today?",
        voice="alice",
        language="en-US",
    )
    
    # Gather speech input
    gather = Gather(
        input="speech",
        action="/api/voice/process",
        method="POST",
        speech_timeout="auto",
        language="en-US",
    )
    gather.say("You can ask about bed availability, make a reservation, or ask about our shelter rules.")
    response.append(gather)
    
    # If no input, redirect
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
    """
    Process speech input from caller.
    
    Flow:
    1. Classify intent (GPT-4)
    2. Query RAG for shelter-specific info
    3. Check bed availability if needed
    4. Create reservation if requested
    5. Respond with appropriate action
    """
    caller_hash = hash_phone(From)
    
    response = VoiceResponse()
    
    if not SpeechResult:
        response.say("I didn't catch that. Let me transfer you to someone who can help.")
        response.redirect("/api/voice/transfer")
        return Response(content=str(response), media_type="application/xml")
    
    # Process through voice agent with database session
    voice_agent = VoiceAgentService(db_session=db)
    result = await voice_agent.process_request(
        transcript=SpeechResult,
        caller_hash=caller_hash,
        call_sid=CallSid,
    )
    
    # Respond based on intent
    response.say(result.response_text, voice="alice", language="en-US")
    
    if result.needs_followup:
        gather = Gather(
            input="speech",
            action="/api/voice/process",
            method="POST",
            speech_timeout="auto",
        )
        gather.say(result.followup_prompt or "Is there anything else I can help you with?")
        response.append(gather)
    else:
        response.say("Thank you for calling. Take care and stay safe.")
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
