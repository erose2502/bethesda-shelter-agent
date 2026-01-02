# Double Commit Fixes - December 18, 2025

## Problem Summary

The application had **double commit issues** where database sessions were being committed twice:
1. Once manually in route handlers or services
2. Once automatically by the `get_db()` dependency (database.py line 59)

This caused:
- Inconsistent transaction boundaries
- Potential race conditions
- Data inconsistency risks
- Violations of the single responsibility principle

## Root Cause

The `get_db()` dependency in `src/db/database.py` automatically commits on successful completion:

```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()  # AUTO-COMMIT HERE
        except Exception:
            await session.rollback()
            raise
```

## Fixes Applied

### 1. **src/api/routes/beds.py**
- ✅ Removed manual `await db.commit()` from `hold_bed_manual()` (line 70)
- ✅ Removed manual `await db.commit()` from `checkin_bed()` (line 92)
- ✅ Removed manual `await db.commit()` from `checkout_bed()` (line 111)

### 2. **src/api/routes/reservations.py**
- ✅ Removed manual `await db.commit()` from `create_reservation()` (line 32)
- ✅ Removed manual `await db.commit()` from `cancel_reservation()` (line 61)
- ✅ Replaced `await db.commit()` with `await db.expire_all()` in `list_active_reservations()` (line 73) to refresh data without committing
- ✅ Removed manual `await db.commit()` from `expire_old_reservations()` (line 86)

### 3. **src/services/reservation_service.py**
- ✅ Removed `await self.db.commit()` from `create_reservation()` (line 79)
- ✅ Kept `await self.db.flush()` to persist within transaction

### 4. **src/services/bed_service.py**
- ✅ Replaced `await self.db.commit()` with `await self.db.flush()` in `simulate_occupancy()`

### 5. **src/services/voice_agent.py**
- ✅ Replaced `await self.db.commit()` with `await self.db.flush()` in `_handle_reservation()` (line 125)

## Best Practices Going Forward

### ✅ DO:
- Let the `get_db()` dependency handle all commits
- Use `await db.flush()` in services to persist changes within the current transaction
- Use `await db.expire_all()` to refresh data without committing
- Keep transaction boundaries at the route level

### ❌ DON'T:
- Never manually `await db.commit()` in route handlers
- Never manually `await db.commit()` in service methods
- Don't mix transaction management between layers

## Transaction Flow

```
Route Handler (with get_db() dependency)
    ↓
Service Layer (uses flush() only)
    ↓
Database Models
    ↓
get_db() commits on success (auto)
```

## Testing Recommendations

After these fixes, test:
1. ✅ Bed reservations through voice calls
2. ✅ Manual reservations through API
3. ✅ Bed hold/checkin/checkout operations
4. ✅ Reservation cancellations
5. ✅ Dashboard real-time updates
6. ✅ Concurrent reservation attempts

## Impact

These fixes ensure:
- ✅ Clean transaction boundaries
- ✅ Predictable commit behavior
- ✅ Reduced race condition risks
- ✅ Better separation of concerns
- ✅ Easier debugging and maintenance
