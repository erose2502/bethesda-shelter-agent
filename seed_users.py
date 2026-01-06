#!/usr/bin/env python3
"""Seed default users into the database."""

import asyncio
from src.db.database import init_default_users


async def main():
    """Initialize default users."""
    print("🌱 Seeding default users...")
    await init_default_users()
    print("✅ Default users created successfully!")
    print("\nYou can now login with:")
    print("  - director@bethesdamission.org / director123")
    print("  - lifecoach@bethesdamission.org / lifecoach123")
    print("  - supervisor@bethesdamission.org / supervisor123")


if __name__ == "__main__":
    asyncio.run(main())
