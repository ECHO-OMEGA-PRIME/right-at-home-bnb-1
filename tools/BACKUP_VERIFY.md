# RAH verified backup schedule and alerting

The FORGE job creates a custom-format PostgreSQL dump of the RAH production
`public` schema, restores it into a temporary PostgreSQL 17 database, and
compares the critical business-table row counts. A dump is accepted only after
that complete verification succeeds.

## Runtime contract

- `echo-rah-backup-verify.timer` runs daily at 09:15 UTC with a bounded random
  delay and `Persistent=true`, so a missed boot window is recovered.
- `echo-rah-backup-verify.service` is `Type=oneshot` and has no `Restart=`.
- `OnFailure=echo-rah-backup-alert@%n.service` reads `Result` and
  `ExecMainStatus` directly from systemd. It does not grep journals for a
  success string.
- Exit 1 is a dump failure, exit 2 is a restore failure, and exit 3 is a row
  mismatch. Exit 3 is labeled `CRITICAL DATA INTEGRITY ALERT` in Telegram.
- `echo-rah-backup-silence.timer` checks hourly. It alerts when the daily timer
  is disabled/inactive, the last verifier result is non-success, or the newest
  valid dump is missing or more than 36 hours old. Repeated identical alerts
  are limited to one every six hours, and a recovery message is sent when all
  three signals return healthy. This hourly path retries incidents whose first
  `OnFailure` notification could not be delivered.
- Alerts use the live `echo.social.telegram_post` SDK capability. The watchdog
  reads FORGE's existing sovereign key at runtime, while the target lives in
  `/etc/rah-backup-alert.env`; no Telegram credential is stored in this repo.
  The fleet-owned `/home/forge/cc_tg.py` helper is retained only as a fallback.

## Secret boundary

`DIRECT_URL` exists only in `/etc/rah-backup-verify.env` on FORGE:

```text
DIRECT_URL=<production PostgreSQL connection URL>
```

The file must include `RAH_VERIFY_PASSWORD` for the isolated local PostgreSQL
17 verifier role and must be owned by `root:root` with mode `0600`. systemd
copies it into a per-service credential mount with `LoadCredential=`; the URI
is never placed in the service environment or a process argument. The verifier
materializes a private libpq passfile, publishes only non-secret connection
metadata to child environments, and deletes the passfile at exit. Never print,
journal, commit, or copy this file into an ops backup. Deployment stops if the
file is absent, has weaker permissions, or lacks either required variable.

New dumps use a hidden `.partial` filename during dump, restore, and row-count
comparison. The public `rah-<timestamp>.dump` filename is created by an atomic
rename only after every check passes, so freshness can never accept a failed
restore or mismatch.

The Telegram target is similarly isolated in `/etc/rah-backup-alert.env`:

```text
RAH_BACKUP_TG_CHAT_ID=<configured operator chat>
```

That file is also `root:root` mode `0600`. It contains no bot token; current
Telegram credentials remain owned by the SDK capability.

## Deploy and verify

Stage this `tools/` directory on FORGE, then run:

```bash
sudo bash ./deploy_backup_verify.sh /path/to/staged/tools
sudo systemctl start echo-rah-backup-silence.service
sudo systemctl start echo-rah-backup-verify.service
systemctl show echo-rah-backup-verify.service \
  -p Result -p ExecMainStatus -p InactiveExitTimestamp
systemctl list-timers echo-rah-backup-verify.timer echo-rah-backup-silence.timer
```

Expected backup state is `Result=success` and `ExecMainStatus=0`. Confirm the
new dump is a root/forge-restricted file larger than 10 KiB, but never inspect
or copy its contents. Unit tests run as part of deployment and can also be run
with `python3 tools/test_backup_watchdog.py`.

## Incident response

1. Read the named service status and the last 100 journal lines.
2. Exit 1: inspect free space, network reachability, and `pg_dump` diagnostics.
3. Exit 2: inspect the local PostgreSQL 17 cluster and `pg_restore` diagnostics.
4. Exit 3: treat the dump as unverified. Compare schema/table availability;
   never promote that dump as a recovery point.
5. After correcting the cause, start `echo-rah-backup-verify.service` once and
   then run `echo-rah-backup-silence.service`. A recovery message confirms the
   timer and dump-age signals are both green.

The deploy script saves prior unit files, the previous immutable release
target, and each timer's enabled/active state under
`/var/backups/rah-ops/<timestamp>-<digest>/`. Rollback is armed before the
first symlink or unit mutation and restores all three if activation fails.
