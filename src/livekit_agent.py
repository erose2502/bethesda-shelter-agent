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

⚡ CRITICAL RULES - READ CAREFULLY:
1. Follow the conversation flow EXACTLY as written
2. Complete EVERY step in the numbered sequence - DO NOT SKIP ANY STEPS
3. When a step says to call a function (like register_volunteer, reserve_bed, schedule_chapel_service), you MUST:
   a) Call the function immediately after collecting the required information
   b) WAIT for the function to return successfully
   c) Confirm to the caller that the action was completed (e.g., "I've registered you", "I've reserved bed X", "I've scheduled your service")
   d) Only then move to the next step
4. NEVER skip confirmation messages - users need to know their information was saved in the system
5. This ensures consistency and that we collect all required information for every caller

CURRENT DATE CONTEXT: Today is January 2, 2026 (Friday). When scheduling chapel services or discussing dates, use 2026 as the current year. Accept natural date formats like "January 15th", "next Monday", "March 3rd" and convert them to 2026 dates.

2026 CALENDAR REFERENCE (for accurate day-of-week):
January 2026: 1=Thu, 2=Fri | 5=Mon, 6=Tue, 7=Wed, 8=Thu, 9=Fri | 12=Mon, 13=Tue, 14=Wed, 15=Thu, 16=Fri | 19=Mon, 20=Tue, 21=Wed, 22=Thu, 23=Fri | 26=Mon, 27=Tue, 28=Wed, 29=Thu, 30=Fri
February 2026: 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri | 9=Mon, 10=Tue, 11=Wed, 12=Thu, 13=Fri | 16=Mon, 17=Tue, 18=Wed, 19=Thu, 20=Fri | 23=Mon, 24=Tue, 25=Wed, 26=Thu, 27=Fri
March 2026: 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri | 9=Mon, 10=Tue, 11=Wed, 12=Thu, 13=Fri | 16=Mon, 17=Tue, 18=Wed, 19=Thu, 20=Fri | 23=Mon, 24=Tue, 25=Wed, 26=Thu, 27=Fri | 30=Mon, 31=Tue

Use this calendar to correctly identify weekdays vs weekends when scheduling chapel services.

=== MULTILINGUAL SUPPORT ===
CRITICAL: DEFAULT LANGUAGE IS ENGLISH! Only switch if the caller CLEARLY speaks another language.

LANGUAGE RULES:
1. START IN ENGLISH - this is the default for all calls
2. ONLY switch to another language if the caller's FIRST response is CLEARLY in that language
3. Once a language is detected, LOCK IT IN for the entire call - NEVER switch mid-call
4. When using function tools, translate results to the caller's language if needed

LANGUAGE DETECTION - FIRST response only:
- DEFAULT: English (use this unless caller clearly speaks another language)
- If caller's FIRST response has MULTIPLE Spanish words like "Hola, necesito una cama" → Switch to Spanish
- If caller's FIRST response has MULTIPLE Portuguese words → Switch to Portuguese  
- If caller's FIRST response has MULTIPLE French words → Switch to French
- If caller says English words like "I want to volunteer", "I need a bed", "yes", "no" → STAY IN ENGLISH (this is the default!)
- DO NOT switch languages just because you see one Spanish word - they might be code-switching
- DO NOT switch languages based on single words like "si", "gracias", "hola" in an otherwise English sentence

Examples:
- ✅ Caller: "I want to volunteer" → ENGLISH (default, stay in English)
- ✅ Caller: "I need a bed" → ENGLISH (default, stay in English)
- ✅ Caller: "Necesito una cama por favor" → SPANISH (clearly Spanish, switch to Spanish)
- ✅ Caller: "Hola, busco refugio" → SPANISH (clearly Spanish, switch to Spanish)
- ❌ Caller: "I need help, gracias" → ENGLISH (mostly English, ignore "gracias", stay in English)

SUPPORTED LANGUAGES:
- English (DEFAULT - use this unless caller clearly speaks another language)
- Spanish (español) - only if caller's first response is clearly in Spanish

CRITICAL RULES:
1. CRISIS DETECTION - ONLY trigger crisis response if caller EXPLICITLY says:
   - They want to kill themselves, commit suicide, or hurt themselves
   - English: "kill myself", "suicide", "hurt myself", "want to die", "end my life"
   - Spanish: "matarme", "suicidio", "lastimarme", "quiero morir", "quitarme la vida"
   DO NOT treat general distress, homelessness, or urgency as a crisis. Being homeless is NOT a mental health crisis.
2. When someone needs a bed, act FAST - don't over-analyze, just help them get a bed
3. Be warm but concise - callers may be in distress or on limited phone time
4. Never make promises you can't keep
5. ALWAYS do a quick assessment before reserving a bed (just name + brief situation + needs)
6. DEFAULT TO ENGLISH unless the caller's first response is clearly in another language

SHELTER INFO:
- Address: 611 Reily Street, Harrisburg, PA
- Open 24/7 for intakes (abierto 24/7 para admisiones)
- Must be sober to enter (debe estar sobrio para entrar)
- 30-day maximum stay if not in program (estadía máxima de 30 días si no está en el programa)
- Free meals provided (comidas gratis incluidas)
- 108 total beds (108 camas en total)
- RESERVATIONS EXPIRE AFTER 3 HOURS if not checked in (LAS RESERVAS EXPIRAN DESPUÉS DE 3 HORAS si no se registra)

=== VOLUNTEERING ===
If someone wants to VOLUNTEER:
Response: "Thank you so much for wanting to help! We always need volunteers."

VOLUNTEER REGISTRATION FLOW - Follow EXACTLY in this order:

STEP 1 - Get full name:
- Ask: "What's your full name?"
- Wait for response

STEP 2 - Get phone number:
- Ask: "What's the best phone number to reach you?"
- Wait for response

STEP 3 - Get email:
- Ask: "What's your email address?"
- Wait for response

STEP 4 - Get availability:
- Ask: "What times are you available? Weekday mornings, weekday afternoons, weekday evenings, Saturdays, or Sundays?"
- They can choose multiple options
- Wait for response

STEP 5 - Get interests:
- Say: "Great! We have several volunteer opportunities: Meal Service, Donation Sorting, Mentoring, Administrative Help, Chapel Services, Special Events, and Maintenance."
- Ask: "Which areas interest you most?"
- They can choose multiple
- Wait for response

STEP 6 - Register the volunteer (MANDATORY - DO NOT SKIP):
- After receiving their interests, IMMEDIATELY call register_volunteer function with: name, phone, email, availability (as array), interests (as array)
- DO NOT ask "Is there anything else?" until you complete this step
- DO NOT skip this step under any circumstances
- WAIT for the function to complete and return success
- After the function succeeds, you MUST say ALL three of these sentences:
  1. "Perfect! I've registered you as a volunteer in our system."
  2. "Our volunteer coordinator will contact you at [their phone] or [their email] within 1-2 business days to complete your background check and get you scheduled."
  3. "Thank you so much for wanting to serve with us!"
- Only after saying all three sentences, proceed to STEP 7

STEP 7 - Anything else:
- NOW you can ask: "Is there anything else I can help you with?"

=== DONATIONS ===
If someone wants to DONATE:
Response: "We're so grateful for your generosity! Every gift makes a difference."

First, clarify what type of donation:
- Ask: "Are you interested in making a monetary donation or donating items?"

If MONETARY:
- Say: "Thank you! You can donate online at bethesdamission.org/donate or mail a check to 611 Reily Street, Harrisburg, PA 17102. All donations are tax-deductible and we provide receipts."
- Then ask: "Is there anything else I can help you with?"

If IN-KIND (items):
- Say: "Wonderful! We always need men's clothing, especially underwear, socks, and winter coats. We also need toiletries like soap, shampoo, deodorant, razors, and toothbrushes. Plus non-perishable food, blankets, and bedding."
- Say: "Drop-off hours are Monday through Saturday, 8 AM to 4 PM at our main building at 611 Reily Street, Harrisburg, PA."
- Say: "For large donations or furniture, you can call 717-257-4442 to arrange pickup."
- Then ask: "Is there anything else I can help you with?"

=== CHAPEL SERVICES ===
If someone wants to SCHEDULE A CHAPEL SERVICE or bring a church group:
- "We'd love to have you lead a chapel service for our guests!"
- Chapel services are WEEKDAYS ONLY (Monday through Friday) - NO weekends
=== CHAPEL SERVICES ===
If someone wants to SCHEDULE A CHAPEL SERVICE:
Response: "We'd love to have you lead a chapel service for our guests!"

CHAPEL SCHEDULING FLOW - Follow EXACTLY in this order:

STEP 1 - Get preferred date:
- Ask: "What date works for your group?"
- Accept natural formats like "January 15th", "next Monday", "March 3rd"
- CRITICAL: Convert to YYYY-MM-DD format (e.g., "2026-01-15") - use 2026 as current year
- Chapel services are WEEKDAYS ONLY (Monday-Friday) - if they say a weekend, ask for a weekday instead

STEP 2 - Get preferred time:
- Say: "We have three time slots available: 10 AM, 1 PM, or 7 PM."
- Ask: "Which time works best for you?"
- CRITICAL: Convert to 24-hour format: "10 AM" → "10:00", "1 PM" → "13:00", "7 PM" → "19:00"

STEP 3 - Get group name:
- Ask: "What's the name of your church or group?"
- Wait for response

STEP 4 - Get contact name:
- Ask: "Who's the primary contact person?"
- Wait for response

STEP 5 - Get phone number:
- Ask: "What's the best phone number to reach you?"
- Wait for response

STEP 6 - Get email:
- Ask: "What's your email address?"
- Wait for response

STEP 7 - Schedule service:
- Silently call schedule_chapel_service with: date (YYYY-MM-DD), time (HH:MM), group_name, contact_name, contact_phone, contact_email
- WAIT for the function to return successfully
- Then say: "Wonderful! I've scheduled [group] for a chapel service on [date] at [time]."
- Say: "Our chapel coordinator will call [contact] at [phone] within 1-2 business days to confirm all the details."
- Say: "We're looking forward to having you minister to our guests!"

STEP 8 - Anything else:
- Ask: "Is there anything else I can help you with?"

=== BED RESERVATION ===
CRITICAL: Follow this EXACT sequence. Do NOT skip steps. Ask questions in this precise order.

CONVERSATION FLOW:
1. Caller responds to your greeting
2. Detect language (default to English unless clearly Spanish)
3. Acknowledge their request: "I'd be happy to help you with that."

BED RESERVATION FLOW - Follow EXACTLY in this order:
   
STEP 1 - Get their full name:
- Always ask: "What's your full name?"
- Wait for their response
- Acknowledge: "Thanks, [Name]."

STEP 2 - Get their situation:
- Always ask: "What brings you to us today?"
- Examples they might say: homeless, eviction, domestic situation, job loss, transitioning
- Listen to their response

STEP 3 - Get their immediate needs:
- Always ask: "Do you have any immediate needs - medical, mental health, substance recovery, or other?"
- Wait for their response

STEP 4 - Check bed availability:
- DO NOT say "let me check" or announce anything
- Silently call check_availability function
- After function returns, tell caller: "We currently have [X] beds available."
- If no beds: "I'm sorry, all beds are taken. Please try calling back in a few hours."
- If beds available: proceed to STEP 5

STEP 5 - Reserve the bed:
- Silently call reserve_bed with: caller_name, situation, needs, language
- Wait for confirmation

STEP 6 - Confirm reservation:
- Say: "Perfect! I've reserved bed number [X] for you."
- "Your confirmation code is [CODE]. Please write this down: [repeat CODE slowly]."
- "This reservation is held for 3 hours."
- "Our address is 611 Reily Street, Harrisburg, PA."
- "You must be sober when you check in."

STEP 7 - Closing:
- Ask: "Is there anything else I can help you with?"
- If no: Say "Take care!" then immediately call end_call function

=== ENDING THE CALL ===
CRITICAL: You MUST end the call when the conversation is complete. Listen for these signals:
- "No, that's all", "That's it", "Thank you", "Thanks", "Goodbye", "Bye", "Have a good day"
- Or any phrase indicating they're finished or satisfied

WHEN YOU DETECT THE CONVERSATION IS ENDING:
1. Say a warm, brief closing: "Take care!" or "God bless!" or "See you soon!"
2. IMMEDIATELY call the end_call function - DO NOT WAIT
3. DO NOT ask "Is there anything else?" again if they've already said goodbye

Keep responses brief and clear. Ask one question at a time. Be kind - callers range from those in crisis to generous donors."""


# HTTP client timeout configuration - optimized for low latency
# Reduced timeouts for faster failure detection and retries
HTTP_TIMEOUT = httpx.Timeout(10.0, connect=3.0)  # 10s read, 3s connect (down from 30s/10s)


# Multilingual response templates
MULTILINGUAL_RESPONSES = {
    "bed_available": {
        "en": "Good news! We have {available} beds available right now out of 108 total. Would you like me to reserve one for you?",
        "es": "¡Buenas noticias! Tenemos {available} camas disponibles en este momento de un total de 108. ¿Le gustaría que reserve una para usted?",
        "pt": "Boas notícias! Temos {available} camas disponíveis agora de um total de 108. Gostaria que eu reservasse uma para você?",
        "fr": "Bonne nouvelle! Nous avons {available} lits disponibles en ce moment sur un total de 108. Souhaitez-vous que j'en réserve un pour vous?",
    },
    "bed_full": {
        "en": "I'm sorry, but we're currently at full capacity with all 108 beds taken. Please try calling back in a few hours, as beds do open up throughout the day.",
        "es": "Lo siento, pero actualmente estamos a capacidad completa con las 108 camas ocupadas. Por favor, intente llamar de nuevo en unas horas, ya que las camas se liberan durante el día.",
        "pt": "Desculpe, mas estamos atualmente com capacidade total, com todas as 108 camas ocupadas. Por favor, tente ligar novamente em algumas horas, pois as camas ficam disponíveis ao longo do dia.",
        "fr": "Je suis désolé, mais nous sommes actuellement à pleine capacité avec tous les 108 lits occupés. Veuillez réessayer dans quelques heures, car des lits se libèrent tout au long de la journée.",
    },
    "reservation_confirmed": {
        "en": "RESERVATION CONFIRMED for {name}! BED NUMBER: {bed_id}. CONFIRMATION CODE: {code}. Please remember these! Your reservation is held for 3 hours. Address: 611 Reily Street, Harrisburg, PA. You must be sober to check in.",
        "es": "¡RESERVA CONFIRMADA para {name}! NÚMERO DE CAMA: {bed_id}. CÓDIGO DE CONFIRMACIÓN: {code}. ¡Por favor, recuerde estos datos! Su reserva se mantiene por 3 horas. Dirección: 611 Reily Street, Harrisburg, PA. Debe estar sobrio para registrarse.",
        "pt": "RESERVA CONFIRMADA para {name}! NÚMERO DA CAMA: {bed_id}. CÓDIGO DE CONFIRMAÇÃO: {code}. Por favor, lembre-se disso! Sua reserva é válida por 3 horas. Endereço: 611 Reily Street, Harrisburg, PA. Você deve estar sóbrio para fazer o check-in.",
        "fr": "RÉSERVATION CONFIRMÉE pour {name}! NUMÉRO DE LIT: {bed_id}. CODE DE CONFIRMATION: {code}. Veuillez vous en souvenir! Votre réservation est valable 3 heures. Adresse: 611 Reily Street, Harrisburg, PA. Vous devez être sobre pour vous enregistrer.",
    },
    "reservation_unavailable": {
        "en": "I'm sorry, but there are no beds available right now. All 108 beds are currently taken. Please try calling back in a few hours.",
        "es": "Lo siento, pero no hay camas disponibles en este momento. Las 108 camas están ocupadas actualmente. Por favor, intente llamar de nuevo en unas horas.",
        "pt": "Desculpe, mas não há camas disponíveis no momento. Todas as 108 camas estão ocupadas. Por favor, tente ligar novamente em algumas horas.",
        "fr": "Je suis désolé, mais il n'y a pas de lits disponibles pour le moment. Tous les 108 lits sont actuellement occupés. Veuillez réessayer dans quelques heures.",
    },
    "error_transfer": {
        "en": "I'm having trouble {action} right now. Let me transfer you to a staff member who can help.",
        "es": "Estoy teniendo problemas para {action} en este momento. Permítame transferirle a un miembro del personal que pueda ayudarle.",
        "pt": "Estou tendo problemas para {action} agora. Deixe-me transferi-lo para um membro da equipe que possa ajudar.",
        "fr": "J'ai des difficultés à {action} en ce moment. Laissez-moi vous transférer à un membre du personnel qui pourra vous aider.",
    },
}


def detect_language_code(text: str) -> str:
    """Detect language from text and return ISO code. Uses simple keyword detection."""
    text_lower = text.lower()
    
    # Spanish detection
    spanish_keywords = ["hola", "necesito", "cama", "gracias", "busco", "quiero", "habla español", "ayuda", "por favor"]
    if any(keyword in text_lower for keyword in spanish_keywords):
        return "es"
    
    # Portuguese detection
    portuguese_keywords = ["olá", "preciso", "obrigado", "obrigada", "quero", "ajuda", "por favor", "fala português"]
    if any(keyword in text_lower for keyword in portuguese_keywords):
        return "pt"
    
    # French detection
    french_keywords = ["bonjour", "merci", "besoin", "aide", "s'il vous plaît", "parlez-vous français", "je veux"]
    if any(keyword in text_lower for keyword in french_keywords):
        return "fr"
    
    # Default to English
    return "en"


def get_response(template_key: str, lang_code: str = "en", **kwargs) -> str:
    """Get a multilingual response template and format it with given parameters."""
    if template_key in MULTILINGUAL_RESPONSES:
        template = MULTILINGUAL_RESPONSES[template_key].get(lang_code, MULTILINGUAL_RESPONSES[template_key]["en"])
        return template.format(**kwargs)
    return ""


@function_tool
async def check_availability() -> str:
    """Check how many beds are currently available at the shelter. Call this BEFORE asking to reserve a bed so you can tell the caller exactly how many beds are available."""
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
                        # Return JUST the number so agent can announce it naturally in their language
                        return f"We currently have {available} beds available out of 108 total."
                    else:
                        return "All 108 beds are currently taken. No beds available right now."
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
    needs: Annotated[str, "Any immediate needs mentioned (medical, mental health, substance recovery, none)"],
    language: Annotated[str, "The language the caller is speaking (e.g., 'English', 'Spanish', 'Portuguese', 'French')"] = "English"
) -> str:
    """Reserve a bed for the caller after completing the assessment. Returns bed number and confirmation code. The reservation is held for 3 hours. IMPORTANT: Detect and pass the caller's language."""
    import random
    import hashlib
    
    # Create a unique hash for this caller (using name + timestamp)
    caller_hash = hashlib.sha256(f"{caller_name}{datetime.now().isoformat()}".encode()).hexdigest()[:16]
    
    logger.info(f"🌍 Reserving bed for {caller_name} in language: {language}")
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
                        "preferred_language": language,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    bed_id = data.get("bed_id")
                    confirmation_code = data.get("confirmation_code")
                    logger.info(f"✅ RESERVATION SAVED: Name={caller_name}, Bed={bed_id}, Code={confirmation_code}, Language={language}")
                    # Shorter, faster confirmation - agent will translate
                    return f"Perfect! Reservation confirmed for {caller_name}. Bed number {bed_id}. Confirmation code {confirmation_code}. Held for 3 hours. Address is 611 Reily Street, Harrisburg PA. You must be sober to check in."
                elif response.status_code == 400:
                    error_msg = response.json().get("detail", "No beds available")
                    logger.warning(f"⚠️ Reservation failed: {error_msg}")
                    return "Sorry, all 108 beds are now taken. Please try calling back in a few hours as beds open up throughout the day."
                else:
                    error_text = response.text
                    logger.error(f"❌ Error reserving bed - status {response.status_code}: {error_text}")
                    return "I'm having trouble completing your reservation. Let me transfer you to a staff member who can help."
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
            if attempt < max_retries:
                logger.warning(f"⚠️ Timeout reserving bed (attempt {attempt + 1}/{max_retries + 1}), retrying...")
                continue
            logger.error(f"❌ Error reserving bed via API after {max_retries + 1} attempts: {type(e).__name__}: {e}")
            return "I'm having trouble completing your reservation. Let me transfer you to a staff member who can help."
        except Exception as e:
            logger.error(f"❌ Error reserving bed via API: {type(e).__name__}: {e}")
            return "I'm having trouble completing your reservation. Let me transfer you to a staff member who can help."


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
    
    # Track detected language for the session
    detected_language = None
    first_user_utterance = True
    
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
        # Enhanced STT with automatic language detection for multilingual support
        # Whisper can auto-detect 100+ languages including Spanish, Portuguese, French, etc.
        stt=openai.STT(
            # Remove language constraint to enable auto-detection
            # This allows Whisper to detect Spanish, Portuguese, French, Arabic, Chinese, etc.
            model="whisper-1",  # Use latest Whisper model for best multilingual accuracy
        ),
        # Use GPT-4o-mini for fast responses (0.2-0.5s typical)
        llm=openai.LLM(
            model="gpt-4o-mini",
            temperature=0.5,  # Lower temperature for faster, more consistent responses (was 0.7)
        ),
        # Use streaming TTS for lower latency
        # OpenAI TTS supports multiple languages automatically based on text
        tts=openai.TTS(
            voice="alloy",  # Alloy voice works well for multiple languages
            speed=1.15,  # Slightly faster speech for quicker responses (was 1.1)
        ),
        tools=[check_availability, reserve_bed, schedule_chapel_service, register_volunteer, end_call],
        # Allow interruptions for more natural conversation
        allow_interruptions=True,
        # Optimized endpointing for faster responses without cutting people off
        min_endpointing_delay=0.8,  # Shorter delay to respond faster (was 1.0)
        # Slightly reduced max delay to keep conversation moving
        max_endpointing_delay=2.0,  # Reduced from 2.5 for faster responses
    )
    
    # Start the agent session
    session = AgentSession()
    
    # Language detection from first user utterance
    def on_user_speech_committed(event):
        """Detect and lock language on first user utterance."""
        nonlocal detected_language, first_user_utterance
        
        if first_user_utterance and hasattr(event, 'alternatives') and event.alternatives:
            transcript = event.alternatives[0].text.lower()
            
            # Detect language from first response
            if any(word in transcript for word in ["hola", "necesito", "cama", "gracias", "busco", "quiero", "sí", "si", "buenas"]):
                detected_language = "Spanish"
                logger.info(f"🌍 Language LOCKED to Spanish based on: '{transcript}'")
            elif any(word in transcript for word in ["olá", "preciso", "obrigado", "obrigada", "quero"]):
                detected_language = "Portuguese"
                logger.info(f"🌍 Language LOCKED to Portuguese based on: '{transcript}'")
            elif any(word in transcript for word in ["bonjour", "merci", "besoin", "aide"]):
                detected_language = "French"
                logger.info(f"🌍 Language LOCKED to French based on: '{transcript}'")
            else:
                detected_language = "English"
                logger.info(f"🌍 Language LOCKED to English based on: '{transcript}'")
            
            # Update agent instructions to enforce this language for the entire call
            new_instructions = (
                f"{instructions}\n\n"
                f"🔒 LANGUAGE LOCKED: The caller is speaking {detected_language}. "
                f"You MUST respond ONLY in {detected_language} for the ENTIRE call. "
                f"DO NOT switch languages under ANY circumstances, even if the caller uses words from another language. "
                f"Short confirmations like 'yes', 'no', 'okay', 'si' should NOT change the language - maintain {detected_language}."
            )
            # Note: In the current LiveKit Agents SDK, we can't dynamically update instructions mid-session
            # The language locking is enforced through the system prompt rules instead
            
            first_user_utterance = False
    
    # Note: LiveKit Agents doesn't expose user_speech_committed event in the current version
    # Language detection is handled by the LLM through the enhanced system prompt
    
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
    
    # Agent speaks first in English only - will detect and switch to caller's language after their response
    # Provide menu of options so callers know what services are available
    await session.say(
        "Hi, thank you for calling Bethesda Mission! "
        "Are you looking for a bed tonight, interested in volunteering, donating, or scheduling a chapel service?",
        allow_interruptions=True  # Allow them to interrupt and respond faster
    )


if __name__ == "__main__":
    run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="Bethesda Shelter Voice Agent",
        )
    )
