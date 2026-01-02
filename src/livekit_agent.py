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
SHELTER_SYSTEM_PROMPT = """You are a compassionate voice assistant for Bethesda Mission Men's Shelter. We do 24/7 intakes.

LANGUAGE: If the caller speaks in Spanish, respond in Spanish. If they speak another language, try to respond in their language. Default to English.

CRITICAL RULES:
1. If caller mentions suicide, self-harm, or crisis - immediately say: "I hear you're going through something serious. Please stay on the line. You can call 988 for the Suicide Prevention Lifeline anytime." (Translate if needed)
2. Be warm but concise - callers may be in distress or on limited phone time
3. Never make promises you can't keep
4. ALWAYS do a quick assessment before reserving a bed

SHELTER INFO:
- Address: 611 Reily Street, Harrisburg, PA
- Open 24/7 for intakes
- Must be sober to enter
- 30-day maximum stay if not in program
- Free meals provided
- 108 total beds
- RESERVATIONS EXPIRE AFTER 3 HOURS if not checked in

VOLUNTEERING:
If someone wants to VOLUNTEER, tell them:
- "Thank you so much for wanting to help! We always need volunteers."
- Volunteer opportunities include: serving meals, sorting donations, mentoring guests, administrative help, and special events
- Meal serving times: Breakfast 7-8 AM, Lunch 12-1 PM, Dinner 5-6 PM
- They can sign up online at bethesdamission.org/volunteer or call our volunteer coordinator at 717-257-4442
- Groups and individuals are welcome
- Background check required for ongoing volunteers
- Minimum age is 16 with adult supervision, 18 to volunteer alone

DONATIONS:
If someone wants to DONATE, tell them:
- "We're so grateful for your generosity! Every gift makes a difference."
- MONETARY DONATIONS: Visit bethesdamission.org/donate or mail to 611 Reily Street, Harrisburg, PA 17102
- IN-KIND DONATIONS we always need:
  * Men's clothing (especially underwear, socks, and winter coats)
  * Toiletries (soap, shampoo, deodorant, razors, toothbrushes)
  * Non-perishable food items
  * Blankets and bedding
- Drop-off hours: Monday-Saturday 8 AM to 4 PM at our main building
- For large donations or furniture, call 717-257-4442 to arrange pickup
- All donations are tax-deductible, and we provide receipts

CONVERSATION FLOW:
1. Wait for the caller to respond to your greeting
2. If they want a bed, do a QUICK ASSESSMENT:
   - Ask for their first name and last name
   - Ask briefly about their current situation (homeless, eviction, etc.)
   - Ask if they have any immediate needs (medical, mental health, substance recovery)
3. Use check_availability to see if beds are available - TELL THEM THE NUMBER of beds available
4. If available and they want one, use reserve_bed with their info
5. After reserving, you MUST clearly tell them:
   - Their BED NUMBER (e.g., "You have bed number 42")
   - Their CONFIRMATION CODE (e.g., "Your confirmation code is BM-1234")
   - "Your reservation is held for 3 hours. Please arrive within that time or it will expire."
6. Give them the address: 611 Reily Street, Harrisburg, PA
7. Ask "Is there anything else I can help you with?"
8. If they say no, goodbye, thank you, or indicate they're done - say a brief goodbye and USE end_call IMMEDIATELY

IMPORTANT: When the caller says goodbye, thanks, no more questions, or indicates they're done, you MUST:
1. Say a brief "Take care, we'll see you tonight!" or similar
2. Call the end_call function to hang up

Keep responses brief and clear. Ask one question at a time. Be kind - many callers are in difficult situations."""


# HTTP client timeout configuration (connect=10s, read=30s, write=10s, pool=5s)
HTTP_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


@function_tool
async def check_availability() -> str:
    """Check how many beds are currently available at the shelter. Always tell the caller the exact number."""
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                # FIX: Correct endpoint is /api/beds/ not /api/beds/summary
                response = await client.get(f"{API_BASE_URL}/api/beds/")
                if response.status_code == 200:
                    data = response.json()
                    available = data.get("available", 0)
                    logger.info(f"✅ Real bed availability: {available}/108")
                    if available > 0:
                        return f"Good news! We have {available} beds available right now out of 108 total. Would you like me to reserve one for you?"
                    else:
                        return "I'm sorry, but we're currently at full capacity with all 108 beds taken. Please try calling back in a few hours, as beds do open up throughout the day."
                else:
                    error_text = response.text
                    logger.error(f"❌ Error checking availability - status {response.status_code}: {error_text}")
                    # Return error message instead of fake data
                    return "I'm having trouble checking bed availability right now. Let me transfer you to a staff member who can help."
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
            if attempt < max_retries:
                logger.warning(f"⚠️ Timeout checking availability (attempt {attempt + 1}/{max_retries + 1}), retrying...")
                continue
            logger.error(f"❌ Error checking availability after {max_retries + 1} attempts: {type(e).__name__}: {e}")
            return "I'm having trouble checking bed availability right now. Let me transfer you to a staff member who can help."
        except Exception as e:
            logger.error(f"❌ Error checking availability: {type(e).__name__}: {e}")
            return "I'm having trouble checking bed availability right now. Let me transfer you to a staff member who can help."


@function_tool
async def reserve_bed(
    caller_name: Annotated[str, "The caller's first and last name"],
    situation: Annotated[str, "Brief description of caller's situation (homeless, eviction, etc.)"],
    needs: Annotated[str, "Any immediate needs mentioned (medical, mental health, substance recovery, none)"]
) -> str:
    """Reserve a bed for the caller after completing the assessment. Returns bed number and confirmation code. The reservation is held for 3 hours."""
    import random
    import hashlib
    
    # Create a unique hash for this caller (using name + timestamp)
    caller_hash = hashlib.sha256(f"{caller_name}{datetime.now().isoformat()}".encode()).hexdigest()[:16]
    
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                response = await client.post(
                    f"{API_BASE_URL}/api/reservations/",
                    json={
                        "caller_hash": caller_hash,
                        "caller_name": caller_name,
                        "situation": situation,
                        "needs": needs,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    bed_id = data.get("bed_id")
                    confirmation_code = data.get("confirmation_code")
                    logger.info(f"✅ RESERVATION SAVED: Name={caller_name}, Bed={bed_id}, Code={confirmation_code}")
                    return f"RESERVATION CONFIRMED for {caller_name}! BED NUMBER: {bed_id}. CONFIRMATION CODE: {confirmation_code}. Please remember these! Your reservation is held for 3 hours. Address: 611 Reily Street, Harrisburg, PA. You must be sober to check in."
                elif response.status_code == 400:
                    error_msg = response.json().get("detail", "No beds available")
                    logger.warning(f"⚠️ Reservation failed: {error_msg}")
                    return "I'm sorry, but there are no beds available right now. All 108 beds are currently taken. Please try calling back in a few hours."
                else:
                    error_text = response.text
                    logger.error(f"❌ Error reserving bed - status {response.status_code}: {error_text}")
                    return "I'm having trouble completing your reservation right now. Let me transfer you to a staff member who can help."
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
            if attempt < max_retries:
                logger.warning(f"⚠️ Timeout reserving bed (attempt {attempt + 1}/{max_retries + 1}), retrying...")
                continue
            logger.error(f"❌ Error reserving bed via API after {max_retries + 1} attempts: {type(e).__name__}: {e}")
            return "I'm having trouble completing your reservation right now. Let me transfer you to a staff member who can help."
        except Exception as e:
            logger.error(f"❌ Error reserving bed via API: {type(e).__name__}: {e}")
            return "I'm having trouble completing your reservation right now. Let me transfer you to a staff member who can help."


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
        # Prevent interruptions while agent is speaking
        allow_interruptions=True,
        # Wait longer before assuming user is done speaking
        min_endpointing_delay=0.8,
    )
    
    # Start the agent session
    session = AgentSession()
    
    # Handle end_call function - disconnect the call when triggered
    @session.on("function_tools_executed")
    def on_tools_executed(event):
        for output in event.function_call_outputs:
            if output and output.output == "CALL_ENDED":
                logger.info("Call ended by agent - closing session")
                # Close the session which will disconnect the SIP call
                import asyncio
                asyncio.create_task(session.aclose())
    
    await session.start(agent, room=ctx.room)
    logger.info("Agent started and ready to assist caller")
    
    # Agent speaks first - greet the caller immediately
    await session.say("Hi, you've reached Bethesda Mission. Are you currently looking for a bed?", allow_interruptions=False)


if __name__ == "__main__":
    run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
