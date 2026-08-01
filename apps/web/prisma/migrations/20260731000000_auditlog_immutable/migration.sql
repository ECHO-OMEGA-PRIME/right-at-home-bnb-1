-- Make AuditLog append-only (P5 objective 3: "immutable audit logs").
--
-- Before this, rah_app held UPDATE and DELETE on AuditLog with no trigger and no
-- rule protecting it. A bug, an injection, or anyone holding the application
-- credential could rewrite or erase the record of who did what — which is the
-- one thing an audit trail exists to prevent.
--
-- TWO LAYERS, deliberately:
--   1. REVOKE the grants. Least privilege; the app has no business updating a log.
--   2. A TRIGGER that raises regardless of grants. Grants can be re-granted by a
--      later migration or a well-meaning DBA; the trigger keeps the guarantee
--      when that happens, and states WHY in the error text.
--
-- INSERT is untouched. Writing new audit rows must keep working, and there is a
-- positive control for exactly that in the verification.
--
-- CONSEQUENCE, ACCEPTED ON PURPOSE: no retention pruning and no correction of a
-- bad row. An audit log you can tidy is an audit log you can launder. If rows
-- must ever be aged out, that is a deliberate operation by the table owner, not
-- something the application can do.

CREATE OR REPLACE FUNCTION audit_log_is_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'AuditLog is append-only: % is not permitted. It is the record of who did what; correcting it would defeat its purpose. Insert a compensating entry instead.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auditlog_no_update ON "AuditLog";
CREATE TRIGGER auditlog_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

DROP TRIGGER IF EXISTS auditlog_no_delete ON "AuditLog";
CREATE TRIGGER auditlog_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

REVOKE UPDATE, DELETE ON "AuditLog" FROM rah_app;
