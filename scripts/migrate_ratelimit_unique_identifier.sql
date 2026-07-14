-- RateLimitLog.identifier -> UNIQUE (rate-limit.ts atomic upsert/updateMany rewrite depends on this).
-- `prisma db push` fails on this DB (orders_classId_fkey FK drift, see vps_deployment memory) —
-- apply this DDL manually via mysql CLI, same as prior migrate_*.sql scripts.
--
-- Step 1: dedupe. Old findFirst+update code could (rarely, under a race) create more than one
-- row per identifier. Keep the most recently updated row per identifier, delete the rest.
DELETE t1 FROM rate_limit_logs t1
INNER JOIN rate_limit_logs t2
  ON t1.identifier = t2.identifier
  AND (t1.updatedAt < t2.updatedAt OR (t1.updatedAt = t2.updatedAt AND t1.id < t2.id));

-- Step 2: add the unique constraint (MySQL creates a backing index automatically).
ALTER TABLE rate_limit_logs ADD UNIQUE INDEX rate_limit_logs_identifier_key (identifier);
