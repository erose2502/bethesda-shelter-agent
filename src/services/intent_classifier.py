"""Intent Classification Service - GPT-4 powered."""

import json
from typing import Optional

from openai import AsyncOpenAI

from src.config import get_settings
from src.models.schemas import IntentClassification, Intent


INTENT_SYSTEM_PROMPT = """You are an intent classifier for a homeless shelter's voice assistant.

Your job is to classify caller intent into one of these categories:
- bed_inquiry: Asking about bed availability, capacity, how many beds
- make_reservation: Wanting to reserve/book a bed
- check_reservation: Checking status of existing reservation
- shelter_rules: Questions about rules, curfew, sobriety requirements, what to bring
- directions: Asking for location, address, how to get there
- crisis: Signs of immediate distress, danger, self-harm, or mental health crisis
- transfer_staff: Explicit request to talk to a person/staff
- other: Anything else

CRITICAL: If you detect ANY signs of crisis (suicidal thoughts, immediate danger, severe distress), 
classify as "crisis" regardless of what they're asking about.

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
    """Quick intent classification using keywords (fallback)."""
    transcript_lower = transcript.lower()
    
    # Crisis keywords - HIGHEST PRIORITY
    crisis_words = ["kill", "suicide", "hurt myself", "end it", "can't go on", "emergency"]
    if any(word in transcript_lower for word in crisis_words):
        return Intent.CRISIS
    
    # Bed inquiry keywords
    bed_words = ["bed", "available", "space", "room", "stay", "sleep", "capacity"]
    if any(word in transcript_lower for word in bed_words):
        return Intent.BED_INQUIRY
    
    # Reservation keywords
    reserve_words = ["reserve", "book", "hold", "save"]
    if any(word in transcript_lower for word in reserve_words):
        return Intent.MAKE_RESERVATION
    
    # Rules keywords
    rules_words = ["rule", "curfew", "sober", "alcohol", "drug", "allowed", "bring"]
    if any(word in transcript_lower for word in rules_words):
        return Intent.SHELTER_RULES
    
    # Directions keywords
    direction_words = ["where", "address", "location", "directions", "get there", "far"]
    if any(word in transcript_lower for word in direction_words):
        return Intent.DIRECTIONS
    
    # Transfer keywords
    transfer_words = ["person", "human", "staff", "someone", "talk to"]
    if any(word in transcript_lower for word in transfer_words):
        return Intent.TRANSFER_STAFF
    
    return Intent.OTHER
