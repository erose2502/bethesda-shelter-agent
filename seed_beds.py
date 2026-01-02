import asyncio
from src.db.database import init_db

async def seed():
    print("🌱 Connecting to database...")
    try:
        await init_db()
        print("✅ SUCCESS: 108 Beds created.")
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(seed())
