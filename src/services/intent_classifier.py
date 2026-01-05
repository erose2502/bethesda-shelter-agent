"""Intent Classification Service - GPT-4 powered."""

import json
from typing import Optional

from openai import AsyncOpenAI

from src.config import get_settings
from src.models.schemas import IntentClassification, Intent


INTENT_SYSTEM_PROMPT = """You are an intent classifier for a homeless shelter's voice assistant that supports MULTIPLE LANGUAGES (English, Spanish, Portuguese, French, etc.).

Your job is to classify caller intent into one of these categories:
- bed_inquiry: Asking about bed availability, capacity, how many beds (in any language: "bed", "cama", "leito", "lit")
- make_reservation: Wanting to reserve/book a bed (in any language: "reserve", "reservar", "réserver")
- check_reservation: Checking status of existing reservation
- shelter_rules: Questions about rules, curfew, sobriety requirements, what to bring
- directions: Asking for location, address, how to get there (in any language: "where", "dónde", "onde", "où")
- crisis: Signs of ACTUAL SEVERE crisis - ONLY classify as crisis if there is EXPLICIT mention of suicide, self-harm, wanting to die, or immediate danger to self or others
- transfer_staff: Explicit request to talk to a person/staff
- other: Anything else

CRITICAL CRISIS DETECTION RULES:
1. ONLY classify as "crisis" if the caller EXPLICITLY mentions:
   - Suicide/suicidal thoughts (English: "suicide", "kill myself" | Spanish: "suicidio", "matarme", "quitarme la vida" | Portuguese: "suicídio", "me matar" | French: "suicide", "me tuer")
   - Self-harm or wanting to die (English: "hurt myself", "want to die", "end my life" | Spanish: "lastimarme", "quiero morir", "terminar mi vida" | Portuguese: "me machucar", "quero morrer" | French: "me blesser", "veux mourir")
   - Immediate danger to themselves or others
2. DO NOT classify as crisis just because someone is:
   - Homeless or in a difficult situation
   - Asking for help or a bed urgently
   - Frustrated or upset about their circumstances
   - Using words that sound like crisis words in another language
3. When in doubt, prefer "bed_inquiry" or "other" over "crisis"
4. Being homeless and needing shelter is NOT a crisis classification - only actual suicidal ideation or self-harm

Respond with JSON only:
{
    "intent": "one_of_the_categories_above",
    "confidence": 0.0 to 1.0,
    "entities": {
        "optional_extracted_info": "value"
    }
}
"""


class IntentClassifier:
    """
    Classify caller intent using GPT-4.
    
    Why GPT-4:
    - Strong with emotional/distressed speech
    - Reliable JSON outputs
    - Good at detecting crisis signals
    """

    def __init__(self):
        self.settings = get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.openai_api_key)

    async def classify(self, transcript: str) -> IntentClassification:
        """
        Classify the intent of a caller's statement.
        
        Args:
            transcript: The speech-to-text result from caller
            
        Returns:
            IntentClassification with intent, confidence, and entities
        """
        if not transcript or not transcript.strip():
            return IntentClassification(
                intent=Intent.OTHER,
                confidence=0.0,
                entities={},
            )

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",  # Using GPT-4o for cost-effectiveness
                messages=[
                    {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Caller said: {transcript}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,  # Low temperature for consistent classification
                max_tokens=150,
            )

            result = json.loads(response.choices[0].message.content)
            
            # Map to Intent enum
            intent_str = result.get("intent", "other").lower()
            intent = self._map_intent(intent_str)
            
            return IntentClassification(
                intent=intent,
                confidence=result.get("confidence", 0.8),
                entities=result.get("entities", {}),
            )

        except Exception as e:
            # On error, default to OTHER with low confidence
            # This ensures the system keeps working
            print(f"Intent classification error: {e}")
            return IntentClassification(
                intent=Intent.OTHER,
                confidence=0.3,
                entities={"error": str(e)},
            )

    def _map_intent(self, intent_str: str) -> Intent:
        """Map string intent to Intent enum."""
        mapping = {
            "bed_inquiry": Intent.BED_INQUIRY,
            "make_reservation": Intent.MAKE_RESERVATION,
            "check_reservation": Intent.CHECK_RESERVATION,
            "shelter_rules": Intent.SHELTER_RULES,
            "directions": Intent.DIRECTIONS,
            "crisis": Intent.CRISIS,
            "transfer_staff": Intent.TRANSFER_STAFF,
            "other": Intent.OTHER,
        }
        return mapping.get(intent_str, Intent.OTHER)


# Quick classification without full service (for testing/fallback)
async def quick_classify(transcript: str) -> Intent:
    """Quick intent classification using keywords (fallback) - MULTILINGUAL."""
    transcript_lower = transcript.lower()
    
    # Crisis keywords - HIGHEST PRIORITY - VERY STRICT
    # Only trigger on explicit self-harm/suicide mentions, not general distress
    crisis_words = [
        "kill myself", "suicide", "suicidio", "suicídio", "hurt myself", 
        "end my life", "want to die", "quiero morir", "quero morrer",
        "matarme", "quitarme la vida", "me matar", "me tuer"
    ]
    if any(word in transcript_lower for word in crisis_words):
        return Intent.CRISIS
    
    # Bed inquiry keywords (multilingual)
    bed_words = [
        "bed", "beds", "available", "cama", "camas", "disponible", 
        "leito", "lit", "disponível", "space", "room", "stay", "sleep"
    ]
    if any(word in transcript_lower for word in bed_words):
        return Intent.BED_INQUIRY
    
    # Reservation keywords (multilingual)
    reserve_words = [
        "reserve", "reservar", "réserver", "book", "hold", "save"
    ]
    if any(word in transcript_lower for word in reserve_words):
        return Intent.MAKE_RESERVATION
    
    # Rules keywords (multilingual)
    rules_words = [
        "rule", "regla", "règle", "curfew", "toque de queda", 
        "sober", "sobrio", "sóbrio", "alcohol", "drug", "droga"
    ]
    if any(word in transcript_lower for word in rules_words):
        return Intent.SHELTER_RULES
    
    # Directions keywords (multilingual)
    direction_words = [
        "where", "dónde", "onde", "où", "address", "dirección", 
        "endereço", "adresse", "location", "ubicación", "localização"
    ]
    if any(word in transcript_lower for word in direction_words):
        return Intent.DIRECTIONS
    
    # Transfer keywords (multilingual)
    transfer_words = [
        "person", "persona", "pessoa", "personne", "human", "staff", 
        "personal", "someone", "talk to", "hablar con", "falar com"
    ]
    if any(word in transcript_lower for word in transfer_words):
        return Intent.TRANSFER_STAFF
    
    return Intent.OTHER
