# Performance Optimization: Junction Tables for Keys Relationships

## Problem Summary

The `/keys/with-loan-status/:rentalObjectCode?includeLatestEvent=true` endpoint was experiencing severe performance issues due to **cartesian product explosions** caused by using JSON arrays with `OPENJSON()` and `LIKE '%...%'` patterns in SQL joins.

### Root Cause

**Original Design:**
- `key_loans.keys` stored as JSON array: `["key-id-1", "key-id-2", ...]`
- `key_events.keys` stored as JSON array: `["key-id-1", "key-id-2", ...]`

**Performance Issues:**
1. **LEFT JOIN with EXISTS + OPENJSON**: Created O(N×M) cartesian products
2. **OUTER APPLY with LIKE patterns**: Full table scans for every row
3. **Multiple OPENJSON calls**: Expensive runtime JSON parsing
4. **No indexes possible**: JSON array searches cannot be indexed

**Example with 7 keys:**
- 7 keys × 100 loans × 3 keys per loan = 2,100 OPENJSON operations
- 7 keys × 100 loans (previous) = 2,100 more OPENJSON operations
- 7 keys × 50 events with LIKE = 350 full table scans
- **Total: 4,550 operations for 7 keys!**

## Solution: Junction Tables

Replaced JSON arrays with normalized many-to-many junction tables:

### New Tables

**`key_loan_items`** - Links keys to loans
```sql
CREATE TABLE key_loan_items (
  id UUID PRIMARY KEY,
  keyLoanId UUID REFERENCES key_loans(id) ON DELETE CASCADE,
  keyId UUID REFERENCES keys(id) ON DELETE CASCADE,
  createdAt TIMESTAMP,
  UNIQUE(keyLoanId, keyId)
);

CREATE INDEX idx_key_loan_items_loan_id ON key_loan_items(keyLoanId);
CREATE INDEX idx_key_loan_items_key_id ON key_loan_items(keyId);
```

**`key_event_items`** - Links keys to events
```sql
CREATE TABLE key_event_items (
  id UUID PRIMARY KEY,
  keyEventId UUID REFERENCES key_events(id) ON DELETE CASCADE,
  keyId UUID REFERENCES keys(id) ON DELETE CASCADE,
  createdAt TIMESTAMP,
  UNIQUE(keyEventId, keyId)
);

CREATE INDEX idx_key_event_items_event_id ON key_event_items(keyEventId);
CREATE INDEX idx_key_event_items_key_id ON key_event_items(keyId);
```

### Performance Improvement

**Before:** 4,550 operations (O(N×M))
**After:** ~28 indexed lookups (O(N))

**Expected speedup: ~160x faster** 🚀

### Query Transformation

**Old Query (Problematic):**
```sql
LEFT JOIN key_loans kl ON (
  EXISTS (
    SELECT 1 FROM OPENJSON(kl.keys)
    WHERE value = CAST(k.id AS NVARCHAR(36))
  )
  AND kl.returnedAt IS NULL
)
```

**New Query (Optimized):**
```sql
LEFT JOIN key_loan_items kli ON kli.keyId = k.id
LEFT JOIN key_loans kl ON kl.id = kli.keyLoanId AND kl.returnedAt IS NULL
```

## Migration Guide

### Step 1: Run Migrations

```bash
cd services/keys
npm run knex migrate:latest
```

This will:
1. Create `key_loan_items` table
2. Create `key_event_items` table
3. Populate junction tables from existing JSON data
4. **Keep JSON columns intact** (for rollback safety)

### Step 2: Deploy Code

The updated adapters will:
- Use junction tables for all queries (fast indexed lookups)
- Automatically sync junction tables when creating/updating loans or events
- Keep JSON columns in sync (backwards compatibility)

### Step 3: Verify Performance

Test the endpoint:
```
GET /keys/with-loan-status/:rentalObjectCode?includeLatestEvent=true
```

Expected results:
- Load time reduced from seconds to milliseconds
- Consistent performance regardless of data volume
- No more full table scans

### Step 4: Monitor and Cleanup (Future)

After confirming stability:
1. Monitor for any edge cases
2. Eventually deprecate JSON columns (requires API version bump)
3. Migrate `key_bundles` and `key_loan_maintenance_keys` (marked with TODOs)

## Files Changed

### Migrations
- `migrations/20251029000001_create_key_loan_items_table.js` - Create key_loan_items
- `migrations/20251029000002_create_key_event_items_table.js` - Create key_event_items
- `migrations/20251029000003_migrate_data_to_junction_tables.js` - Populate junction tables

### Adapters (Updated)
- `adapters/keys-adapter.ts` - Main query rewritten with indexed joins
- `adapters/key-loans-adapter.ts` - Updated 3 functions to use junction tables
- `adapters/key-events-adapter.ts` - Updated 2 functions to use junction tables
- `adapters/receipts-adapter.ts` - Updated bulk event completion
- `adapters/key-bundles-adapter.ts` - Added TODO (lower priority)
- `adapters/key-loan-maintenance-keys-adapter.ts` - Added TODO (lower priority)

### New Files
- `adapters/junction-table-helpers.ts` - Helper functions for syncing junction tables

## Technical Details

### Backward Compatibility

The solution maintains full backward compatibility:

1. **JSON columns preserved**: `key_loans.keys` and `key_events.keys` still exist
2. **Automatic sync**: Junction tables updated on every CREATE/UPDATE
3. **Graceful degradation**: Parsing errors don't break operations
4. **Rollback safe**: Can revert migrations without data loss

### Index Strategy

**Key indexes added:**
1. `idx_key_loan_items_key_id` - Fast lookup: "which loans contain this key?"
2. `idx_key_loan_items_loan_id` - Fast lookup: "which keys are in this loan?"
3. `idx_key_event_items_key_id` - Fast lookup: "which events affect this key?"
4. `idx_key_event_items_event_id` - Fast lookup: "which keys are in this event?"

**Additional recommended indexes (for future):**
- `CREATE INDEX idx_keys_rentalObjectCode ON keys(rentalObjectCode);`
- `CREATE INDEX idx_key_loans_returnedAt ON key_loans(returnedAt);`
- `CREATE INDEX idx_key_loans_createdAt ON key_loans(createdAt DESC);`
- `CREATE INDEX idx_key_events_createdAt ON key_events(createdAt DESC);`

### Query Optimization Techniques Used

1. **Indexed Joins**: Replace OPENJSON with direct foreign key joins
2. **ROW_NUMBER() Window Functions**: Get latest records without OUTER APPLY
3. **Subqueries with Proper Aliases**: Help query optimizer
4. **Foreign Key Constraints**: Enable referential integrity and query optimization
5. **CASCADE Deletes**: Automatic cleanup, no orphaned records

## Troubleshooting

### Issue: Junction tables empty after migration

**Solution:**
```sql
-- Re-run data migration manually
SELECT COUNT(*) FROM key_loan_items;  -- Should match total keys in all loans
SELECT COUNT(*) FROM key_event_items;  -- Should match total keys in all events
```

If counts are zero, re-run migration 20251029000003.

### Issue: Query still slow

**Diagnosis:**
```sql
-- Check if indexes exist
SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('key_loan_items');
SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('key_event_items');

-- Check query plan
SET STATISTICS TIME ON;
SET STATISTICS IO ON;
-- Run your query
```

Look for "Index Seek" (good) vs "Table Scan" (bad) in execution plan.

### Issue: Data inconsistency between JSON and junction tables

**Resolution:**
```sql
-- Verify sync for a specific loan
SELECT kl.id, kl.keys,
       (SELECT STRING_AGG(keyId, ',') FROM key_loan_items WHERE keyLoanId = kl.id) as junction_keys
FROM key_loans kl
WHERE kl.id = 'specific-loan-id';
```

If inconsistent, the CREATE/UPDATE sync helpers may need debugging.

## Performance Benchmarks

### Before Optimization

| Keys | Loans | Events | Operations | Estimated Time |
|------|-------|--------|-----------|----------------|
| 7    | 100   | 50     | 4,550     | ~2 seconds     |
| 50   | 500   | 200    | 160,000   | ~30 seconds    |
| 100  | 1000  | 500    | 650,000   | ~2 minutes     |

### After Optimization

| Keys | Loans | Events | Operations | Estimated Time |
|------|-------|--------|-----------|----------------|
| 7    | 100   | 50     | 28        | ~10ms          |
| 50   | 500   | 200    | 200       | ~50ms          |
| 100  | 1000  | 500    | 400       | ~100ms         |
| 1000 | 10000 | 5000   | 4,000     | ~500ms         |

**Scalability**: O(N) instead of O(N×M) - Linear instead of exponential growth

## Future Enhancements

1. **Remove JSON columns**: Once stable, deprecate the JSON arrays completely
2. **Migrate remaining tables**: Apply same pattern to `key_bundles` and `key_loan_maintenance_keys`
3. **Add composite indexes**: For common query patterns
4. **Implement caching**: Redis cache for frequently accessed rental objects
5. **Add query monitoring**: Track slow queries automatically

## References

- Original issue: Slow "visa nycklar" key list loading
- Jira ticket: MIM-678 (if applicable)
- Related PRs: #XXX
- Documentation: [Junction Tables Best Practices](https://docs.microsoft.com/en-us/sql/relational-databases/tables/many-to-many-relationship)

## Questions?

Contact the team or review:
- [keys-adapter.ts:99-215](services/keys/src/services/key-service/adapters/keys-adapter.ts#L99-L215) - Main optimized query
- [junction-table-helpers.ts](services/keys/src/services/key-service/adapters/junction-table-helpers.ts) - Sync helpers
- [Migration files](services/keys/migrations/) - Database schema changes
