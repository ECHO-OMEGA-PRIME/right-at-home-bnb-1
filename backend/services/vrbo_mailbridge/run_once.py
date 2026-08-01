from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .evidence import evidence_from_mapping
from .ical_evidence import ingest_configured_feeds
from .imap_ingest import ImapConfig, ingest_once
from .repository import MailBridgeRepository
from .service import run_reconciliation


def _emit(event: str, payload: dict[str, object]) -> None:
    print(
        json.dumps(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event": event,
                **payload,
            },
            sort_keys=True,
            default=str,
        ),
        flush=True,
    )


def _import_jsonl(repository: MailBridgeRepository, path: Path) -> dict[str, int]:
    inserted = 0
    duplicates = 0
    rejected = 0
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
                source_type = str(item.pop("source_type"))
                source_key = str(item.pop("source_key"))
                parser_version = str(item.pop("parser_version", "external-v1"))
                observed_raw = item.pop("observed_at", None)
                observed_at = (
                    datetime.fromisoformat(str(observed_raw).replace("Z", "+00:00"))
                    if observed_raw
                    else None
                )
                evidence = evidence_from_mapping(
                    source_type=source_type,
                    source_key=source_key,
                    payload=item,
                    parser_version=parser_version,
                    observed_at=observed_at,
                )
                _, created = repository.store_evidence(evidence)
                if created:
                    inserted += 1
                else:
                    duplicates += 1
            except Exception as exc:
                rejected += 1
                _emit(
                    "external_evidence_rejected",
                    {
                        "line": line_number,
                        "error": f"{type(exc).__name__}:{exc}",
                    },
                )
    return {"inserted": inserted, "duplicates": duplicates, "rejected": rejected}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="RAH Vrbo MailBridge read-only shadow ingestion and reconciliation",
    )
    parser.add_argument("--dry-run", action="store_true", help="Read and parse without database writes")
    parser.add_argument("--reconcile-only", action="store_true")
    parser.add_argument("--ical-only", action="store_true")
    parser.add_argument("--skip-ical", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--max-messages", type=int)
    parser.add_argument("--import-evidence", type=Path)
    args = parser.parse_args()

    if args.ical_only and args.skip_ical:
        parser.error("--ical-only and --skip-ical cannot be combined")
    if args.reconcile_only and args.ical_only:
        parser.error("--reconcile-only and --ical-only cannot be combined")

    repository = MailBridgeRepository()

    if args.status:
        _emit("status", repository.status_summary())
        return 0

    if args.import_evidence:
        imported = _import_jsonl(repository, args.import_evidence)
        _emit("external_evidence_import", imported)

    if not args.reconcile_only:
        if not args.ical_only and not args.import_evidence:
            config = ImapConfig.from_env()
            stats = ingest_once(
                repository,
                config,
                dry_run=args.dry_run,
                max_messages=args.max_messages,
            )
            _emit("imap_ingest", stats.to_dict())

        if not args.skip_ical:
            ical_stats = ingest_configured_feeds(repository, dry_run=args.dry_run)
            _emit("ical_ingest", ical_stats.to_dict())

        if args.dry_run:
            return 0

    result = run_reconciliation(repository)
    _emit("reconciliation", result)

    # Shadow mode never mutates live operations. Nonzero highlights risk to schedulers.
    if result["status"] == "FAILED":
        return 2
    if int(result["sync_at_risk"]) > 0:
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
