"""LiveKit API endpoints for dashboard real-time updates."""

from fastapi import APIRouter
from livekit import api
import os

router = APIRouter()

# LiveKit credentials from environment
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
DASHBOARD_ROOM = "bethesda-dashboard"


@router.get("/dashboard-token")
async def get_dashboard_token() -> dict:
    """
    Generate a LiveKit access token for the dashboard to receive real-time updates.
    """
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return {"error": "LiveKit credentials not configured"}
    
    # Create access token for dashboard participant
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity("dashboard-viewer")
    token.with_name("Dashboard")
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=DASHBOARD_ROOM,
        can_subscribe=True,
        can_publish=False,  # Dashboard only receives, doesn't publish
    ))
    
    jwt_token = token.to_jwt()
    
    return {
        "token": jwt_token,
        "room": DASHBOARD_ROOM
    }
