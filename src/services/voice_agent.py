"""Voice Agent Service - THE BRAIN for call processing."""

import hashlib
from dataclasses import dataclass
from typing import Optional

from src.config import get_settings
from src.models.schemas import VoiceAgentResult, Intent, ReservationResponse
from src.services.intent_classifier import IntentClassifier
from src.services.rag_service import RAGService
from src.services.bed_service import BedService
from src.services.reservation_service import ReservationService


@dataclass
class CallContext:
    """Context maintained throughout a call."""
    caller_hash: str
    call_sid: str
    intent: Optional[Intent] = None
    reservation: Optional[ReservationResponse] = None


class VoiceAgentService:
    """
    Main voice agent orchestrator.
    
    Flow:
    1. Receive transcript
    2. Classify intent (GPT-4)
    3. Query RAG for shelter-specific info
    4. Check bed availability / create reservation
    5. Generate response
    """

    def __init__(self, db_session=None):
        self.settings = get_settings()
        self.db = db_session
        self.intent_classifier = IntentClassifier()
        self.rag_service = RAGService()

    async def process_request(
        self,
        transcript: str,
        caller_hash: str,
        call_sid: str,
    ) -> VoiceAgentResult:
        """
        Process a voice request and generate appropriate response.
        
        This is the main entry point for all voice interactions.
        """
        context = CallContext(caller_hash=caller_hash, call_sid=call_sid)

        # 1. Classify intent
        classification = await self.intent_classifier.classify(transcript)
        context.intent = classification.intent

        # 2. Handle based on intent
        if classification.intent == Intent.BED_INQUIRY:
            return await self._handle_bed_inquiry(context)
        
        elif classification.intent == Intent.MAKE_RESERVATION:
            return await self._handle_reservation(context)
        
        elif classification.intent == Intent.SHELTER_RULES:
            return await self._handle_rules_question(transcript, context)
        
        elif classification.intent == Intent.CRISIS:
            return await self._handle_crisis(context)
        
        elif classification.intent == Intent.DIRECTIONS:
            return await self._handle_directions(context)
        
        elif classification.intent == Intent.TRANSFER_STAFF:
            return self._handle_transfer_request(context)
        
        else:
            return await self._handle_general_question(transcript, context)

    async def _handle_bed_inquiry(self, context: CallContext) -> VoiceAgentResult:
        """Handle bed availability questions."""
        bed_service = BedService(self.db)
        summary = await bed_service.get_summary()

        if summary.available > 0:
            response = (
                f"Good news. We currently have {summary.available} beds available "
                f"out of {summary.total}. "
                "Would you like me to reserve a bed for you? "
                "The reservation will be held for 3 hours."
            )
            return VoiceAgentResult(
                intent=Intent.BED_INQUIRY,
                response_text=response,
                needs_followup=True,
                followup_prompt="Would you like to reserve a bed?",
            )
        else:
            # No beds available
            response = (
                "I'm sorry, but we don't have any beds available right now. "
                f"All {summary.total} beds are currently occupied or reserved. "
                "Would you like me to tell you about other shelter options in the area, "
                "or would you like to know when beds typically become available?"
            )
            return VoiceAgentResult(
                intent=Intent.BED_INQUIRY,
                response_text=response,
                needs_followup=True,
                followup_prompt="Would you like information about other options?",
            )

    async def _handle_reservation(self, context: CallContext) -> VoiceAgentResult:
        """Handle bed reservation requests."""
        reservation_service = ReservationService(self.db)

        try:
            reservation = await reservation_service.create_reservation(
                caller_hash=context.caller_hash
            )
            context.reservation = reservation

            response = (
                f"Great, I've reserved bed number {reservation.bed_id} for you. "
                f"Your confirmation code is {reservation.confirmation_code}. "
                f"Let me repeat that: {reservation.confirmation_code}. "
                "Please arrive within 3 hours to check in. "
                "When you arrive, give this code to the staff at the front desk."
            )
            return VoiceAgentResult(
                intent=Intent.MAKE_RESERVATION,
                response_text=response,
                needs_followup=True,
                followup_prompt="Is there anything else I can help you with?",
                reservation_created=reservation,
            )
        except ValueError as e:
            error_msg = str(e)
            if "no beds available" in error_msg.lower():
                response = (
                    "I'm sorry, but all beds are currently taken. "
                    "Beds sometimes become available if reservations expire. "
                    "Would you like me to tell you about other shelters in the area?"
                )
            else:
                response = (
                    "I wasn't able to complete the reservation. "
                    "Let me transfer you to a staff member who can help."
                )
            
            return VoiceAgentResult(
                intent=Intent.MAKE_RESERVATION,
                response_text=response,
                needs_followup=True,
            )

    async def _handle_rules_question(
        self, transcript: str, context: CallContext
    ) -> VoiceAgentResult:
        """Handle questions about shelter rules using RAG."""
        # Query RAG for relevant policy info
        policy_info = await self.rag_service.query(transcript)

        if policy_info:
            response = policy_info
        else:
            # Fallback to basic rules
            response = (
                "Here are the key rules for our men's shelter: "
                "Check-in is between 5 PM and 7 PM. "
                "Curfew is at 9 PM. "
                "We require sobriety - no alcohol or drugs on the premises. "
                "Guests must leave by 7 AM and can return for check-in the same evening. "
                "Would you like more details about any specific rule?"
            )

        return VoiceAgentResult(
            intent=Intent.SHELTER_RULES,
            response_text=response,
            needs_followup=True,
            followup_prompt="Would you like to know anything else about our rules or services?",
        )

    async def _handle_crisis(self, context: CallContext) -> VoiceAgentResult:
        """Handle crisis situations - PRIORITY."""
        response = (
            "I hear that you're going through a difficult time. "
            "Your safety is the most important thing right now. "
            "If you're in immediate danger, please call 911. "
            "If you need to talk to someone right now, "
            "the National Crisis Line is available 24/7 at 988. "
            "Would you like me to connect you with a staff member, "
            "or can I help you with shelter services?"
        )
        return VoiceAgentResult(
            intent=Intent.CRISIS,
            response_text=response,
            needs_followup=True,
            followup_prompt="How can I best help you right now?",
            risk_flag="crisis",
        )

    async def _handle_directions(self, context: CallContext) -> VoiceAgentResult:
        """Handle requests for directions/location."""
        # TODO: Pull actual address from config/RAG
        response = (
            "Bethesda Mission Men's Shelter is located at "
            "611 Reily Street in Harrisburg, Pennsylvania. "
            "We're open for check-in from 5 PM to 7 PM every day. "
            "If you're walking, we're near the downtown area. "
            "Would you like any other information?"
        )
        return VoiceAgentResult(
            intent=Intent.DIRECTIONS,
            response_text=response,
            needs_followup=True,
            followup_prompt="Can I help you with anything else?",
        )

    def _handle_transfer_request(self, context: CallContext) -> VoiceAgentResult:
        """Handle requests to speak with staff."""
        response = (
            "Of course, I'll connect you with a staff member. "
            "Please hold while I transfer your call."
        )
        return VoiceAgentResult(
            intent=Intent.TRANSFER_STAFF,
            response_text=response,
            needs_followup=False,
        )

    async def _handle_general_question(
        self, transcript: str, context: CallContext
    ) -> VoiceAgentResult:
        """Handle general questions using RAG."""
        policy_info = await self.rag_service.query(transcript)

        if policy_info:
            response = policy_info
        else:
            response = (
                "I'd be happy to help you with that. "
                "I can help with bed availability, making reservations, "
                "shelter rules, and directions. "
                "What would you like to know?"
            )

        return VoiceAgentResult(
            intent=Intent.OTHER,
            response_text=response,
            needs_followup=True,
            followup_prompt="What would you like help with?",
        )
