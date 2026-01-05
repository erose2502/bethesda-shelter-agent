"""
Add preferred_language column to guests and reservations tables.

This migration adds language tracking to help staff communicate with guests in their preferred language.
"""

import sqlite3
import sys
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "bethesda_shelter.db"


def migrate():
    """Add preferred_language columns to guests and reservations tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists in guests table
        cursor.execute("PRAGMA table_info(guests)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "preferred_language" not in columns:
            print("Adding preferred_language column to guests table...")
            cursor.execute("""
                ALTER TABLE guests 
                ADD COLUMN preferred_language VARCHAR(32) DEFAULT 'English'
            """)
            print("✅ Added preferred_language to guests table")
        else:
            print("⏭️  Column preferred_language already exists in guests table")
        
        # Check if column already exists in reservations table
        cursor.execute("PRAGMA table_info(reservations)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "preferred_language" not in columns:
            print("Adding preferred_language column to reservations table...")
            cursor.execute("""
                ALTER TABLE reservations 
                ADD COLUMN preferred_language VARCHAR(32) DEFAULT 'English'
            """)
            print("✅ Added preferred_language to reservations table")
        else:
            print("⏭️  Column preferred_language already exists in reservations table")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("DATABASE MIGRATION: Add preferred_language columns")
    print("=" * 60)
    print(f"Database: {DB_PATH}")
    print()
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        print("Please run the application first to create the database.")
        sys.exit(1)
    
    migrate()
