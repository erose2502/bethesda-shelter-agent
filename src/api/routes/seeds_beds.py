import asyncio
from src.db.database import init_beds, init_db

async def seed():
    print("🌱 Seeding database...")
    await init_db()
    print("🛏️ Beds created!")

if __name__ == "__main__":
    asyncio.run(seed())