# Database Migrations

## Overview

This directory contains all database schema migrations for the Medical Companion PWA PostgreSQL database.

## Migration Numbering Convention

Migrations are numbered sequentially with a 3-digit prefix:

- **001-099**: Core tables (users, topics, findings, agents, digests)
- **100-199**: Feature additions (timeline, notifications, preferences)
- **200-299**: Bug fixes and optimizations
- **300-399**: Data migrations (transformations, cleanup)

## Current Migrations

| Number | Description | Date | Status |
|--------|-------------|------|--------|
| 004 | Create chats and chat_messages tables | 2026-01 | Applied |
| 005 | Create notifications table | 2026-01 | Applied |
| 006 | Create digest_queue table | 2026-01 | Applied |
| 014 | Fix digest_queue unique constraint | 2026-01 | Applied |
| 015 | Add missing digest columns (layman_summary, etc.) | 2026-02-04 | **PENDING** |

## How to Create a New Migration

1. **Create the migration file**:
   ```bash
   touch XXX_descriptive_name.sql
   ```
   Replace XXX with the next sequential number.

2. **Add migration header**:
   ```sql
   -- Migration: Brief description
   -- Fixes: Issue #XX - Description (if applicable)
   -- Date: YYYY-MM-DD
   -- Author: Your name
   ```

3. **Write forward migration**:
   ```sql
   -- Add your DDL statements here
   ALTER TABLE ...
   CREATE INDEX ...
   ```

4. **Include rollback instructions**:
   ```sql
   -- Rollback instructions (commented):
   -- DROP INDEX IF EXISTS ...
   -- ALTER TABLE ... DROP COLUMN ...
   ```

5. **Update this README** with the new migration entry

6. **Update init.sql** if the migration:
   - Creates new tables
   - Adds columns to existing tables
   - Creates new indexes or constraints

## Applying Migrations

### Development Environment

```bash
# Connect to local PostgreSQL
psql -U postgres -d medical_companion

# Apply a specific migration
\i backend/src/db/migrations/XXX_migration_name.sql
```

### Production Environment

```bash
# SSH to production server
ssh user@server

# Connect to PostgreSQL container
docker exec -it postgres_container_id psql -U postgres -d medical_companion

# Apply migration
\i /path/to/migration.sql
```

### Docker Container Initialization

The `init.sql` file is automatically executed when the PostgreSQL container is created for the first time. It should always reflect the cumulative state of all migrations.

## Migration Best Practices

1. **Always use IF NOT EXISTS/IF EXISTS**: Makes migrations idempotent
   ```sql
   ALTER TABLE digests ADD COLUMN IF NOT EXISTS new_column TEXT;
   ```

2. **Provide defaults for new NOT NULL columns**:
   ```sql
   ALTER TABLE users ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';
   ```

3. **Create indexes CONCURRENTLY in production**:
   ```sql
   CREATE INDEX CONCURRENTLY idx_findings_user_id ON findings(user_id);
   ```

4. **Test migrations on a copy first**:
   - Backup production database
   - Test migration on backup
   - Apply to production only after verification

5. **Document breaking changes**:
   - If a migration requires application code changes
   - Note the deployment order in the migration comments

## Verification Checklist

After applying a migration:

- [ ] Migration runs without errors
- [ ] Rollback instructions work correctly
- [ ] Application still functions properly
- [ ] No performance degradation
- [ ] init.sql updated (if applicable)
- [ ] This README updated

## Troubleshooting

### Common Issues

1. **"column already exists"**: Migration was partially applied
   - Solution: Use `IF NOT EXISTS` clauses

2. **"cannot drop column because other objects depend on it"**: Dependencies exist
   - Solution: Use `CASCADE` carefully or drop dependencies first

3. **Lock timeout in production**: Table is heavily used
   - Solution: Apply during low-traffic period or use CONCURRENTLY

### Emergency Rollback

If a migration causes issues:

1. Stop the application
2. Run the rollback commands from the migration file
3. Restart the application with previous code version
4. Investigate and fix the migration
5. Reapply when ready

## Migration History Log

### 2026-02-04
- Created migration 015 to add missing digest columns
- Fixed production digest generation 404 errors
- Updated init.sql to include all columns

### 2026-01-XX
- Initial migrations 004-014 applied
- Set up digest queue system
- Fixed unique constraints

---

**Important**: Always backup the database before applying migrations in production!