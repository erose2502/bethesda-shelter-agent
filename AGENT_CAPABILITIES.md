# Bethesda Shelter Voice Agent - Full Capabilities

## Overview
**Single Unified Agent** handles ALL caller types through intelligent intent classification and function tools.

## Agent Architecture

### One Agent, Multiple Capabilities
The LiveKit voice agent (`src/livekit_agent.py`) uses:
- **GPT-4o-mini** for natural language understanding and intent classification
- **OpenAI Whisper** for speech-to-text
- **OpenAI TTS (alloy voice)** for text-to-speech
- **Function Tools** to execute actions in real-time

### How It Works
1. **Caller calls in** → Agent greets: "Are you looking for a bed tonight, interested in volunteering, making a donation, or scheduling a chapel service?"
2. **Agent listens** → GPT-4o-mini analyzes what the caller needs
3. **Agent routes** → Uses appropriate function tool(s) to complete the request
4. **Database updated** → Supervisor sees changes in real-time on dashboard

## Function Tools (Agent Actions)

### 1. `check_availability()`
**Purpose:** Check bed availability  
**API:** GET /api/beds/  
**Response:** "We have X beds available out of 108"

### 2. `reserve_bed(caller_name, situation, needs)`
**Purpose:** Reserve a bed for someone needing shelter  
**API:** POST /api/reservations/  
**Returns:** Bed number + confirmation code  
**Expiration:** 3 hours

### 3. `schedule_chapel_service(date, time, group_name, contact_name, contact_phone, contact_email)`
**Purpose:** Book chapel service for church groups  
**API:** POST /api/chapel/  
**Validation:** 
- Weekdays only (no Saturday/Sunday)
- Time slots: 10:00 AM, 1:00 PM, or 7:00 PM
- Conflict checking (no double-booking)
**Returns:** Confirmation with coordinator follow-up promise

### 4. `register_volunteer(name, phone, email, availability, interests)`
**Purpose:** Register new volunteers  
**API:** POST /api/volunteers/  
**Collects:**
- Availability: Weekday Mornings/Afternoons/Evenings, Saturday, Sunday
- Interests: Meal Service, Donation Sorting, Mentoring, Administrative, Chapel Services, Special Events, Maintenance
**Returns:** Registration confirmation with coordinator follow-up promise

### 5. `end_call()`
**Purpose:** Hang up when conversation is complete  
**Trigger:** When caller says goodbye, thanks, or indicates they're done

## Real-Time Data Flow

```
Caller → LiveKit Agent → Function Tool → FastAPI → SQLite Database
                                                        ↓
                                    React Dashboard ← Polling (2-5s intervals)
```

### Database Tables
1. **beds** - 108 total beds with availability status
2. **reservations** - Active bed reservations (auto-expire after 3 hours)
3. **chapel_services** - Scheduled chapel services (PENDING → CONFIRMED → COMPLETED)
4. **volunteers** - Registered volunteers (PENDING → ACTIVE/INACTIVE)

## Example Call Flows

### Call Flow 1: Bed Reservation
```
Agent: "Hi, thank you for calling Bethesda Mission! Are you looking for a bed tonight...?"
Caller: "Yes, I need a bed."
Agent: [uses check_availability()] "We have 12 beds available. May I get your name?"
Caller: "John Smith"
Agent: "And briefly, what's your situation?"
Caller: "I was evicted yesterday"
Agent: "Do you have any immediate needs - medical, mental health?"
Caller: "No, I'm okay"
Agent: [uses reserve_bed()] "Bed 42 is reserved for you. Your confirmation code is BM-1234..."
```

### Call Flow 2: Chapel Service Scheduling
```
Agent: "Hi, thank you for calling Bethesda Mission! Are you looking for a bed tonight...?"
Caller: "We'd like to do a chapel service"
Agent: "We'd love to have you! What date works for your group? Remember, weekdays only."
Caller: "How about next Wednesday, March 5th?"
Agent: "Great! What time - 10 AM, 1 PM, or 7 PM?"
Caller: "7 PM works best"
Agent: "Perfect. What's your church or group name?"
Caller: "Grace Community Church"
Agent: "And who's the main contact person?"
Caller: "Pastor Mike Johnson"
Agent: "Phone number and email?"
Caller: "717-555-1234, mike@gracechurch.org"
Agent: [uses schedule_chapel_service()] "Wonderful! Grace Community Church is scheduled for Wednesday, March 5th at 7 PM..."
```

### Call Flow 3: Volunteer Registration
```
Agent: "Hi, thank you for calling Bethesda Mission! Are you looking for a bed tonight...?"
Caller: "I want to volunteer"
Agent: "Thank you so much! May I get your name?"
Caller: "Sarah Williams"
Agent: "Phone and email?"
Caller: "717-555-9876, sarah@email.com"
Agent: "What times are you available? Weekday mornings, afternoons, evenings, Saturday, or Sunday?"
Caller: "Weekday evenings and Saturday"
Agent: "What areas interest you? Meal service, donation sorting, mentoring, administrative, chapel services, special events, or maintenance?"
Caller: "Meal service and mentoring"
Agent: [uses register_volunteer()] "Thank you, Sarah! I've registered you as a volunteer..."
```

### Call Flow 4: Donation Inquiry
```
Agent: "Hi, thank you for calling Bethesda Mission! Are you looking for a bed tonight...?"
Caller: "I want to donate some clothes"
Agent: "We're so grateful! We always need men's clothing, especially socks, underwear, and winter coats. Drop-off hours are Monday-Saturday 8 AM to 4 PM at our main building, 611 Reily Street..."
[No function tool needed - just information]
```

## Crisis Detection
**HIGHEST PRIORITY** - Overrides all other intents:
```
If caller mentions suicide, self-harm, or crisis:
→ "I hear you're going through something serious. Please stay on the line. 
   You can call 988 for the Suicide Prevention Lifeline anytime."
```

## Multilingual Support
- Auto-detects Spanish and responds in Spanish
- Attempts other languages if detected
- Defaults to English

## Key Behaviors

### What Agent CAN Do:
✅ Reserve beds with confirmation codes  
✅ Schedule chapel services with date/time validation  
✅ Register volunteers with availability/interests  
✅ Check bed availability in real-time  
✅ Provide donation information  
✅ Detect crisis situations  
✅ Hang up gracefully when done  

### What Agent WON'T Do:
❌ Promise beds without checking availability  
❌ Schedule weekend chapel services  
❌ Accept invalid time slots  
❌ Keep callers waiting unnecessarily  
❌ Use jargon or complex language  

## Testing the Agent

### Start the Agent:
```bash
python src/livekit_agent.py start
```

### Test via SIP/Twilio:
1. Call your Twilio number
2. Agent answers with greeting
3. State your need
4. Agent routes to appropriate tool
5. Check dashboard for real-time updates

### Monitor Logs:
```
✅ RESERVATION SAVED: Name=John Smith, Bed=42, Code=BM-1234
✅ CHAPEL SERVICE SCHEDULED: ID=5, Group=Grace Church, Date=2026-03-05
✅ VOLUNTEER REGISTERED: ID=12, Name=Sarah Williams, Interests=['Meal Service']
```

## Dashboard Integration

Supervisors can see everything in real-time at `http://localhost:5173`:

- **Beds Tab**: 108 bed grid with availability
- **Reservations Tab**: Active reservations with countdown timers
- **Chapel Tab**: Upcoming services with status (pending/confirmed/completed)
- **Volunteers Tab**: Volunteer database with search/filter

All data updates every 2-5 seconds via polling.

## Environment Variables Required

```bash
OPENAI_API_KEY=sk-...           # For GPT-4o-mini, Whisper, TTS
LIVEKIT_URL=wss://...          # LiveKit Cloud URL
LIVEKIT_API_KEY=...            # LiveKit API credentials
LIVEKIT_API_SECRET=...         # LiveKit API secret
API_BASE_URL=http://localhost:8000  # FastAPI backend
```

## Future Enhancements

Potential additions:
- SMS confirmation codes
- Email notifications
- Calendar integration for chapel services
- Volunteer shift scheduling
- Donation tracking
- Multi-language expansion
- Analytics dashboard
