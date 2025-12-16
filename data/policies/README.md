# Bethesda Shelter Policy Documents

This folder contains the source-of-truth policy documents that power the RAG system.

## Purpose

The AI voice agent can ONLY answer questions based on these documents. If information isn't here, the agent won't make it up - it will offer to connect the caller with staff.

## Document Structure

Each policy document should include:
- **Category**: intake, rules, curfew, eligibility, services, etc.
- **Clear, simple language**: Written for phone conversations
- **Effective date**: When the policy took effect

## Loading Policies

To load policies into the vector database:

```python
from src.services.rag_service import RAGService
import asyncio

async def load_policy():
    rag = RAGService()
    await rag.add_policy(
        policy_id="intake-001",
        category="intake",
        title="Check-in Hours",
        content="Check-in for the men's shelter is between 5 PM and 7 PM daily. Guests must arrive within this window to secure a bed for the night."
    )

asyncio.run(load_policy())
```

## Example Policies to Add

### Intake Rules
- Check-in hours (5 PM - 7 PM)
- Required documentation (if any)
- First-time guest process

### Shelter Rules  
- Sobriety requirement
- No weapons policy
- Personal belongings policy
- Quiet hours

### Curfew & Schedule
- Curfew time (9 PM)
- Wake-up time
- Checkout time (7 AM)
- Meal times

### Length of Stay
- Night-by-night emergency shelter
- Extended stay programs (if available)
- Referral process for long-term housing

### Services Available
- Meals provided
- Shower/hygiene facilities
- Case management
- Job assistance referrals

### Location & Directions
- Physical address
- Nearby landmarks
- Public transit options
- Parking information

## Important Notes

1. **Keep it conversational** - These will be read aloud by the AI
2. **Be specific** - Include exact times, addresses, requirements
3. **Update regularly** - Outdated info destroys trust
4. **Review quarterly** - Ensure accuracy with shelter staff
