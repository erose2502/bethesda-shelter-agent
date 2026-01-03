#!/usr/bin/env python3
"""
Test script to simulate an incoming call to your LiveKit agent.
This creates a room and connects to test the agent locally.
"""

import asyncio
import os
from livekit import api, rtc

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://elijah-mb42sfu2.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "APIvTBjHc8oPznE")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "1qV8jm7MUIPjDQzf2GR8caaIOV4kcJ0XdW8YSXhiQ4Z")


async def test_agent_connection():
    """Create a test room to verify agent can connect."""
    
    print("🧪 Testing LiveKit Agent Connection...")
    print(f"📡 LiveKit URL: {LIVEKIT_URL}")
    
    # Create LiveKit API client
    livekit_api = api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    )
    
    # Create a test room
    room_name = "test-call-room"
    print(f"\n🏠 Creating test room: {room_name}")
    
    try:
        # Create room
        room = await livekit_api.room.create_room(
            api.CreateRoomRequest(name=room_name)
        )
        print(f"✅ Room created: {room.name} (SID: {room.sid})")
        
        # Generate token for test participant
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity("test-caller").with_name("Test Caller").with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
            )
        )
        
        print(f"\n🎫 Access Token: {token.to_jwt()[:50]}...")
        print(f"\n✨ Your agent should now connect to this room automatically!")
        print(f"   Check your agent logs for connection confirmation.")
        print(f"\n💡 To test voice:")
        print(f"   1. Go to: https://meet.livekit.io/custom")
        print(f"   2. Enter URL: {LIVEKIT_URL}")
        print(f"   3. Enter Token: {token.to_jwt()}")
        print(f"   4. Click 'Connect' and speak!")
        
        # Keep room alive for testing
        print(f"\n⏳ Keeping room alive for 5 minutes for testing...")
        print(f"   Press Ctrl+C to stop and delete the room.\n")
        
        await asyncio.sleep(300)  # 5 minutes
        
    except KeyboardInterrupt:
        print(f"\n\n🛑 Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        # Clean up - delete the test room
        try:
            await livekit_api.room.delete_room(api.DeleteRoomRequest(room=room_name))
            print(f"🧹 Test room deleted")
        except:
            pass
        
        await livekit_api.aclose()


if __name__ == "__main__":
    print("""
╔═══════════════════════════════════════════════════════════╗
║         LiveKit Agent Connection Test                     ║
║                                                           ║
║  This script will create a test room for your agent      ║
║  to connect to, allowing you to test voice interaction   ║
║  before setting up phone integration.                    ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    asyncio.run(test_agent_connection())
