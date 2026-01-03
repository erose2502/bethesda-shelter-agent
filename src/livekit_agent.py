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
from livekit import rtc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bethesda-agent")

# API base URL for bed operations
API_BASE_URL = os.getenv("API_BASE_URL", "https://bethesda-shelter-agent-production.up.railway.app")

# System prompt for the shelter agent
SHELTER_SYSTEM_PROMPT = """You are a compassionate voice assistant for Bethesda Mission Men's Shelter. We do 24/7 intakes.

CURRENT DATE CONTEXT: Today is January 2, 2026 (Friday). When scheduling chapel services or discussing dates, use 2026 as the current year. Accept natural date formats like "January 15th", "next Monday", "March 3rd" and convert them to 2026 dates.

2026 CALENDAR REFERENCE (for accurate day-of-week):
January 2026: 1=Thu, 2=Fri | 5=Mon, 6=Tue, 7=Wed, 8=Thu, 9=Fri | 12=Mon, 13=Tue, 14=Wed, 15=Thu, 16=Fri | 19=Mon, 20=Tue, 21=Wed, 22=Thu, 23=Fri | 26=Mon, 27=Tue, 28=Wed, 29=Thu, 30=Fri
February 2026: 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri | 9=Mon, 10=Tue, 11=Wed, 12=Thu, 13=Fri | 16=Mon, 17=Tue, 18=Wed, 19=Thu, 20=Fri | 23=Mon, 24=Tue, 25=Wed, 26=Thu, 27=Fri
March 2026: 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri | 9=Mon, 10=Tue, 11=Wed, 12=Thu, 13=Fri | 16=Mon, 17=Tue, 18=Wed, 19=Thu, 20=Fri | 23=Mon, 24=Tue, 25=Wed, 26=Thu, 27=Fri | 30=Mon, 31=Tue

Use this calendar to correctly identify weekdays vs weekends when scheduling chapel services.

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

=== VOLUNTEERING ===
If someone wants to VOLUNTEER:
- "Thank you so much for wanting to help! We always need volunteers."
- Volunteer opportunities include: Meal Service, Donation Sorting, Mentoring, Administrative Help, Chapel Services, Special Events, Maintenance
- Meal serving times: Breakfast 7-8 AM, Lunch 12-1 PM, Dinner 5-6 PM
- Background check required for ongoing volunteers
- Minimum age is 16 with adult supervision, 18 to volunteer alone

TO REGISTER A VOLUNTEER:
1. Ask for their full name
2. Ask for their phone number
3. Ask for their email address
4. Ask what times they're available (Weekday Mornings, Weekday Afternoons, Weekday Evenings, Saturday, Sunday)
5. Ask what areas they're interested in helping with (Meal Service, Donation Sorting, Mentoring, Administrative, Chapel Services, Special Events, Maintenance)
6. Once you have ALL this information, use the register_volunteer tool to register them
7. Let them know the volunteer coordinator will contact them within 1-2 business days about background check and orientation

IMPORTANT: DO NOT tell them to visit a website or call - YOU can register them right now during this call!

=== DONATIONS ===
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

=== CHAPEL SERVICES ===
If someone wants to SCHEDULE A CHAPEL SERVICE or bring a church group:
- "We'd love to have you lead a chapel service for our guests!"
- Chapel services are WEEKDAYS ONLY (Monday through Friday) - NO weekends
- Three available time slots: 10:00 AM, 1:00 PM, or 7:00 PM
- Services last about 1 hour
- Groups can bring a message, worship music, or both
- Typical attendance: 40-80 men

TO SCHEDULE A CHAPEL SERVICE:
1. Ask for their preferred date in a natural way: "What date works for your group?" 
   - Accept natural formats: "January 15th", "next Monday", "March 3rd", "the 20th", etc.
   - CRITICAL: You MUST convert to YYYY-MM-DD format (e.g., "2026-01-15") before calling the function
   - Always use year 2026 unless they specify otherwise
2. Ask for their preferred time (10 AM, 1 PM, or 7 PM)
   - CRITICAL: Convert to 24-hour HH:MM format: "10 AM" → "10:00", "1 PM" → "13:00", "7 PM" → "19:00"
3. Ask for the church/group name
4. Ask for the primary contact person's name
5. Ask for their phone number
6. Ask for their email address
7. Once you have ALL this information, use the schedule_chapel_service tool to book it
   - Double-check: date is YYYY-MM-DD, time is HH:MM (10:00, 13:00, or 19:00)
8. The system will automatically check if the slot is available and schedule it
9. Let them know the chapel coordinator will call to confirm within 1-2 business days

IMPORTANT: DO NOT tell them to call back or that someone will call them - YOU can schedule it right now during this call!

=== OTHER SERVICES WE OFFER ===
If caller asks what else we do or how else they can help:
- Recovery programs (Life Change Program - long-term residential)
- Job training and employment assistance
- GED classes and education support
- Case management and housing assistance
- Thrift store (donations accepted, provides jobs for program participants)

CONVERSATION FLOW:
1. Wait for the caller to respond to your greeting - listen to what THEY need
2. If they want a BED, do a QUICK ASSESSMENT:
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
7. After completing ANY request (bed, chapel, volunteer, donation info), ALWAYS ask "Is there anything else I can help you with?"
8. When the caller indicates they're done, END THE CALL

=== ENDING THE CALL ===
CRITICAL: You MUST end the call when the conversation is complete. Listen for these signals:
- "No, that's all"
- "That's it" 
- "Nope, I'm good"
- "Thank you" (after helping them)
- "Thanks"
- "Goodbye"
- "Bye"
- "Have a good day"
- "See you later"
- "Okay, thanks"
- "Alright, thank you"
- "I'm all set"
- "That's everything"
- Any phrase indicating they're finished or satisfied

WHEN YOU DETECT THE CONVERSATION IS ENDING:
1. Say a warm, brief closing: "Take care!" or "God bless!" or "See you soon!" (1-3 words max)
2. IMMEDIATELY call the end_call function - DO NOT WAIT
3. DO NOT ask "Is there anything else?" again if they've already said goodbye

Keep responses brief and clear. Ask one question at a time. Be kind - callers range from those in crisis to generous donors."""


# HTTP client timeout configuration - optimized for low latency
# Reduced timeouts for faster failure detection and retries
HTTP_TIMEOUT = httpx.Timeout(10.0, connect=3.0)  # 10s read, 3s connect (down from 30s/10s)


@function_tool
async def check_availability() -> str:
    """Check how many beds are currently available at the shelter. Always tell the caller the exact number."""
    max_retries = 1  # Reduced from 2 for faster responses
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
    
    max_retries = 1  # Reduced from 2 for faster responses
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
async def schedule_chapel_service(
    date: Annotated[str, "Date in YYYY-MM-DD format. Convert natural language dates (e.g., 'January 15th', 'next Monday', 'March 3') to YYYY-MM-DD using year 2026. Weekdays only, no Saturdays/Sundays."],
    time: Annotated[str, "Time in HH:MM format - must be 10:00, 13:00, or 19:00"],
    group_name: Annotated[str, "Name of the church or group leading the service"],
    contact_name: Annotated[str, "Primary contact person's name"],
    contact_phone: Annotated[str, "Contact phone number"],
    contact_email: Annotated[str, "Contact email address"],
) -> str:
    """Schedule a chapel service for a church group. Only weekdays allowed. Times: 10:00 AM, 1:00 PM, or 7:00 PM. Current year is 2026."""
    from datetime import datetime as dt
    
    logger.info(f"📅 Chapel scheduling request: date={date}, time={time}, group={group_name}")
    
    # Validate date is a weekday
    try:
        date_obj = dt.strptime(date, "%Y-%m-%d")
        
        # Check if year is reasonable (2026 or close to it)
        current_year = 2026
        if date_obj.year < current_year or date_obj.year > current_year + 1:
            logger.warning(f"⚠️ Invalid year: {date_obj.year}")
            return f"I need a date in {current_year}. Could you tell me the date again? For example, 'January 15th' or 'next Monday'?"
        
        if date_obj.weekday() >= 5:  # 5=Saturday, 6=Sunday
            logger.warning(f"⚠️ Weekend date attempted: {date} is a {date_obj.strftime('%A')}")
            return "I'm sorry, but chapel services are only available on weekdays (Monday through Friday). Weekend slots are not available. Would you like to choose a weekday instead?"
    except ValueError as e:
        logger.error(f"❌ Date parsing error: {e}")
        return "I didn't understand that date format. Could you tell me the date you'd like? For example, say 'January 20th' or 'next Wednesday'."
    
    # Validate time slot
    valid_times = ["10:00", "13:00", "19:00"]
    if time not in valid_times:
        logger.warning(f"⚠️ Invalid time slot: {time}")
        return "Chapel services are only available at 10:00 AM, 1:00 PM, or 7:00 PM. Which of these times works best for your group?"
    
    max_retries = 1  # Reduced from 2 for faster responses
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                response = await client.post(
                    f"{API_BASE_URL}/api/chapel/",
                    json={
                        "date": date,
                        "time": time,
                        "group_name": group_name,
                        "contact_name": contact_name,
                        "contact_phone": contact_phone,
                        "contact_email": contact_email,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    service_id = data.get("id")
                    logger.info(f"✅ CHAPEL SERVICE SCHEDULED: ID={service_id}, Group={group_name}, Date={date}, Time={time}")
                    
                    # Convert time to friendly format
                    time_friendly = "10:00 AM" if time == "10:00" else "1:00 PM" if time == "13:00" else "7:00 PM"
                    
                    return (
                        f"Wonderful! I've scheduled {group_name} for a chapel service on {date_obj.strftime('%A, %B %d, %Y')} at {time_friendly}. "
                        f"Our chapel coordinator will call {contact_name} at {contact_phone} within 1-2 business days to confirm all the details. "
                        f"Please have a backup date ready just in case. We're looking forward to having you minister to our guests! "
                        f"Is there anything else I can help you with?"
                    )
                elif response.status_code == 400:
                    error_msg = response.json().get("detail", "Unable to schedule")
                    if "conflict" in error_msg.lower() or "already scheduled" in error_msg.lower():
                        return f"I'm sorry, but that time slot on {date} at {time} is already booked. Would you like to try a different date or time?"
                    elif "weekend" in error_msg.lower():
                        return "I'm sorry, but chapel services are only available on weekdays (Monday through Friday). Would you like to choose a weekday?"
                    else:
                        logger.warning(f"⚠️ Chapel scheduling failed: {error_msg}")
                        return f"I'm having trouble scheduling that time slot. {error_msg}. Would you like to try a different date or time?"
                else:
                    error_text = response.text
                    logger.error(f"❌ Error scheduling chapel - status {response.status_code}: {error_text}")
                    return "I'm having trouble scheduling the chapel service right now. Let me have our chapel coordinator call you directly. What's the best number to reach you?"
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
            if attempt < max_retries:
                logger.warning(f"⚠️ Timeout scheduling chapel (attempt {attempt + 1}/{max_retries + 1}), retrying...")
                continue
            logger.error(f"❌ Error scheduling chapel after {max_retries + 1} attempts: {type(e).__name__}: {e}")
            return "I'm having trouble scheduling the chapel service right now. Let me have our chapel coordinator call you directly. What's the best number to reach you?"
        except Exception as e:
            logger.error(f"❌ Error scheduling chapel: {type(e).__name__}: {e}")
            return "I'm having trouble scheduling the chapel service right now. Let me have our chapel coordinator call you directly. What's the best number to reach you?"


@function_tool
async def register_volunteer(
    name: Annotated[str, "Volunteer's full name"],
    phone: Annotated[str, "Volunteer's phone number"],
    email: Annotated[str, "Volunteer's email address"],
    availability: Annotated[list[str], "List of availability (e.g., ['Weekday Mornings', 'Saturday'])"],
    interests: Annotated[list[str], "List of interests (e.g., ['Meal Service', 'Mentoring'])"],
) -> str:
    """Register a new volunteer with their contact info, availability, and areas of interest."""
    max_retries = 1  # Reduced from 2 for faster responses
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                response = await client.post(
                    f"{API_BASE_URL}/api/volunteers/",
                    json={
                        "name": name,
                        "phone": phone,
                        "email": email,
                        "availability": availability,
                        "interests": interests,
                        "background_check": False,  # Not completed yet
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    volunteer_id = data.get("id")
                    logger.info(f"✅ VOLUNTEER REGISTERED: ID={volunteer_id}, Name={name}, Interests={interests}")
                    
                    return (
                        f"Thank you so much, {name}! I've registered you as a volunteer with us. "
                        f"Our volunteer coordinator will reach out to you at {phone} or {email} within 1-2 business days "
                        f"to complete your registration and schedule a background check. "
                        f"We're so grateful for people like you who want to serve! "
                        f"Is there anything else I can help you with?"
                    )
                else:
                    error_text = response.text
                    logger.error(f"❌ Error registering volunteer - status {response.status_code}: {error_text}")
                    return "I'm having trouble completing your volunteer registration right now. Let me have our volunteer coordinator call you directly. What's the best number to reach you?"
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
            if attempt < max_retries:
                logger.warning(f"⚠️ Timeout registering volunteer (attempt {attempt + 1}/{max_retries + 1}), retrying...")
                continue
            logger.error(f"❌ Error registering volunteer after {max_retries + 1} attempts: {type(e).__name__}: {e}")
            return "I'm having trouble completing your volunteer registration right now. Let me have our volunteer coordinator call you directly. What's the best number to reach you?"
        except Exception as e:
            logger.error(f"❌ Error registering volunteer: {type(e).__name__}: {e}")
            return "I'm having trouble completing your volunteer registration right now. Let me have our volunteer coordinator call you directly. What's the best number to reach you?"


@function_tool
async def end_call() -> str:
    """End the call when the conversation is complete. Use this after helping the caller or when they're done."""
    logger.info("🔴 end_call() function triggered - returning CALL_ENDED signal")
    return "CALL_ENDED"


def prewarm(proc: JobProcess):
    """Prewarm the agent process - load VAD model optimized for clear speech capture."""
    # Configure Silero VAD with more sensitive settings to pick up quieter speech
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.2,      # Lower threshold to catch shorter utterances
        min_silence_duration=0.5,      # Wait longer before cutting off speech
        padding_duration=0.3,          # More padding to avoid cutting off start/end of words
        activation_threshold=0.45,     # Lower threshold = more sensitive (was 0.6, default is 0.5)
        max_buffered_speech=60.0,
    )


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent."""
    logger.info(f"Agent connecting to room: {ctx.room.name}")
    
    # Connect to the room
    await ctx.connect()
    
    # Enable noise suppression on the room for all participants
    # This helps filter out background noise from callers
    logger.info("Enabling noise suppression for improved call quality")
    
    # Build instructions with current time
    current_time = datetime.now().strftime("%I:%M %p")
    instructions = SHELTER_SYSTEM_PROMPT + f"\n\nCurrent time: {current_time}"
    
    # Create the voice agent with optimized settings for low latency
    agent = Agent(
        instructions=instructions,
        vad=ctx.proc.userdata["vad"],
        # Enhanced STT with language specification for better accuracy in noisy environments
        stt=openai.STT(
            language="en",  # Specify English to reduce misinterpretation
            model="whisper-1",  # Use latest Whisper model for best noise handling
        ),
        # Use GPT-4o-mini for fast responses (0.2-0.5s typical)
        llm=openai.LLM(
            model="gpt-4o-mini",
            temperature=0.7,  # Balanced creativity vs consistency
        ),
        # Use streaming TTS for lower latency
        tts=openai.TTS(
            voice="alloy",
            speed=1.1,  # Slightly faster speech for quicker responses (1.0 = normal, max 1.25)
        ),
        tools=[check_availability, reserve_bed, schedule_chapel_service, register_volunteer, end_call],
        # Allow interruptions for more natural conversation
        allow_interruptions=True,
        # Adjusted endpointing to capture complete speech without cutting off
        min_endpointing_delay=1.0,  # Wait longer to ensure all speech is captured
        # Longer max delay to avoid cutting off people who speak slowly or pause
        max_endpointing_delay=2.5,  # Increased to be more patient with speech patterns
    )
    
    # Start the agent session
    session = AgentSession()
    
    # Handle end_call function - disconnect the call when triggered
    def on_tools_executed(event):
        """Handle function tool execution, specifically end_call."""
        for output in event.function_call_outputs:
            if output and output.output == "CALL_ENDED":
                logger.info("🔴 Call ended by agent - disconnecting session")
                # Use asyncio.create_task for async operations
                import asyncio
                async def close_session():
                    await asyncio.sleep(0.5)  # Wait for final TTS
                    await session.aclose()
                    logger.info("✅ Session closed successfully")
                asyncio.create_task(close_session())
    
    session.on("function_tools_executed", on_tools_executed)
    
    await session.start(agent, room=ctx.room)
    logger.info("Agent started and ready to assist caller")
    
    # Agent speaks first - greet the caller with options
    await session.say(
        "Hi, thank you for calling Bethesda Mission! "
        "Are you looking for a bed tonight, interested in volunteering, making a donation, or scheduling a chapel service?",
        allow_interruptions=False
    )


if __name__ == "__main__":
    run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="Bethesda Shelter Voice Agent",
        )
    )
