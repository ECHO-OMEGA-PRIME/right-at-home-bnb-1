-- Close the TRUNCATE hole left by the append-only migration.
--
-- The BEFORE UPDATE/DELETE triggers are FOR EACH ROW, and TRUNCATE does not
-- fire row-level triggers. rah_app still held TRUNCATE, so the entire audit log
-- could be erased in one statement while UPDATE and DELETE of a single row were
-- both correctly blocked.
--
-- That is the operation an attacker or a runaway cleanup script would actually
-- reach for, and the control missed it. Found by reading the grants back after
-- applying the first migration rather than trusting it.

CREATE OR REPLACE FUNCTION audit_log_no_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'AuditLog is append-only: TRUNCATE is not permitted. Erasing the record of who did what is precisely what this table exists to prevent.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auditlog_no_truncate ON "AuditLog";
CREATE TRIGGER auditlog_no_truncate
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_no_truncate();

REVOKE TRUNCATE ON "AuditLog" FROM rah_app;
