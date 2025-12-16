"""LiveKit Voice Agent for Bethesda Shelter."""

import logging
import httpx
import os
from datetime import datetime
from typing import Annotated

from livekit.agents import JobContext, JobProcess, WorkerOptions
from livekit.agents.cli import run_app
from livekit.agents.llm import function_tool
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import openai, silero

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bethesda-agent")

# API base URL for bed operations
API_BASE_URL = os.getenv("API_BASE_URL", "https://bethesda-shelter-agent-production.up.railway.app")

# System prompt for the shelter agent
SHELTER_SYSTEM_PROMPT = """You are a compassionate voice assistant for Bethesda Mission Men's Shelter.

CRITICAL RULES:
1. If caller mentions suicide, self-harm, or crisis - immediately say: "I hear you're going through something serious. Please stay on the line. You can call 988 for the Suicide Prevention Lifeline anytime."
2. Be warm but concise - callers may be in distress or on limited phone time
3. Never make promises you can't keep
4. ALWAYS do a quick assessment before reserving a bed

SHELTER INFO:
- Address: 611 Reily Street, Harrisburg, PA
- Check-in: 5 PM - 7 PM daily
- Curfew: 9 PM (no entry after)
- Must be sober to enter
- 30-day maximum stay
- Free meals provided
- 108 total beds

CONVERSATION FLOW:
1. Greet the caller warmly
2. If they want a bed, do a QUICK ASSESSMENT first:
   - Ask for their first name
   - Ask briefly about their current situation (homeless, eviction, etc.)
   - Ask if they have any immediate needs (medical, mental health, substance recovery)
3. Use check_availability to see if beds are available
4. If available and they want one, use reserve_bed with their info
5. Confirm the reservation and remind them of check-in time (5-7 PM)
6. When done, use end_call to hang up politely

Keep responses brief and clear. Ask one question at a time. Be kind - many callers are in difficult situations."""


@function_tool
async def check_availability() -> str:
    """Check how many beds are currently available at the shelter."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_BASE_URL}/beds/availability", timeout=10)
            if response.status_code == 200:
                data = response.json()
                available = data.get("available_beds", 0)
                if available > 0:
                    return f"Good news! There are {available} beds available tonight."
                else:
                    return "I'm sorry, but we're fully booked tonight. Please try calling back tomorrow morning."
            else:
                return "I'm having trouble checking availability right now. Please try again in a moment."
    except Exception as e:
        logger.error(f"Error checking availability: {e}")
        return "I'm having trouble checking availability right now. Please try again in a moment."


@function_tool
async def reserve_bed(
    caller_name: Annotated[str, "The caller's first name"],
    situation: Annotated[str, "Brief description of caller's situation (homeless, eviction, etc.)"],
    needs: Annotated[str, "Any immediate needs mentioned (medical, mental health, substance recovery, none)"]
) -> str:
    """Reserve a bed for the caller after completing the assessment."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE_URL}/reservations/",
                json={
                    "caller_name": caller_name,
                    "situation": situation,
                    "needs": needs,
                    "phone_hash": "voice_call"  # We don't have the actual number here
                },
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                bed_id = data.get("bed_id", "unknown")
                return f"Great news, {caller_name}! I've reserved bed number {bed_id} for you. Please arrive between 5 PM and 7 PM tonight. Remember, you must be sober to check in. The address is 611 Reily Street, Harrisburg, PA."
            elif response.status_code == 400:
                return "I'm sorry, but there are no beds available right now. Please try calling back tomorrow morning."
            else:
                return "I'm having trouble making the reservation. Please try again or come directly to the shelter between 5-7 PM."
    except Exception as e:
        logger.error(f"Error reserving bed: {e}")
        return "I'm having trouble making the reservation. Please come directly to the shelter between 5-7 PM and we'll do our best to help you."


@function_tool
async def end_call() -> str:
    """End the call when the conversation is complete. Use this after helping the caller or when they're done."""
    return "CALL_ENDED"


def prewarm(proc: JobProcess):
    """Prewarm the agent process - load VAD model once."""
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent."""
    logger.info(f"Agent connecting to room: {ctx.room.name}")
    
    # Connect to the room
    await ctx.connect()
    
    # Build instructions with current time
    current_time = datetime.now().strftime("%I:%M %p")
    instructions = SHELTER_SYSTEM_PROMPT + f"\n\nCurrent time: {current_time}"
    
    # Create the voice agent with function tools
    agent = Agent(
        instructions=instructions,
        vad=ctx.proc.userdata["vad"],
        stt=openai.STT(),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=openai.TTS(voice="alloy"),
        tools=[check_availability, reserve_bed, end_call],
    )
    
    # Start the agent session
    session = AgentSession()
    
    # Handle end_call function - check outputs for CALL_ENDED signal
    @session.on("function_tools_executed")
    def on_tools_executed(event):
        for output in event.function_call_outputs:
            if output and output.output == "CALL_ENDED":
                logger.info("Call ended by agent")
                session.close()
    
    await session.start(agent, room=ctx.room)
    logger.info("Agent started and ready to assist caller")


if __name__ == "__main__":
    run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
