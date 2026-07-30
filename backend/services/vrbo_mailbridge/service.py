from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .models import ConsensusStatus
from .reconcile import reconcile_all
from .repository import MailBridgeRepository


def run_reconciliation(repository: MailBridgeRepository) -> dict[str, Any]:
    started_at = datetime.now(timezone.utc)
    evidence = repository.load_evidence()
    results = reconcile_all(evidence)

    errors: list[str] = []
    for result in results:
        try:
            repository.upsert_ledger(result)
        except Exception as exc:
            errors.append(f"{result.reservation_key}:{type(exc).__name__}:{exc}")

    counts = {
        ConsensusStatus.CONSISTENT.value: 0,
        ConsensusStatus.UNVERIFIED.value: 0,
        ConsensusStatus.SYNC_AT_RISK.value: 0,
    }
    for result in results:
        counts[result.consensus_status.value] += 1

    completed_at = datetime.now(timezone.utc)
    status = "FAILED" if errors and len(errors) == len(results) else ("PARTIAL" if errors else "SUCCESS")
    details = {
        "mode": "SHADOW",
        "errors": errors,
        "sync_at_risk_keys": [
            result.reservation_key
            for result in results
            if result.consensus_status == ConsensusStatus.SYNC_AT_RISK
        ],
    }
    run_id = repository.record_run(
        status=status,
        started_at=started_at,
        completed_at=completed_at,
        evidence_count=len(evidence),
        reservation_count=len(results),
        consistent_count=counts[ConsensusStatus.CONSISTENT.value],
        unverified_count=counts[ConsensusStatus.UNVERIFIED.value],
        sync_at_risk_count=counts[ConsensusStatus.SYNC_AT_RISK.value],
        error_count=len(errors),
        details=details,
    )

    return {
        "run_id": run_id,
        "mode": "SHADOW",
        "status": status,
        "evidence_count": len(evidence),
        "reservation_count": len(results),
        "consistent": counts[ConsensusStatus.CONSISTENT.value],
        "unverified": counts[ConsensusStatus.UNVERIFIED.value],
        "sync_at_risk": counts[ConsensusStatus.SYNC_AT_RISK.value],
        "errors": errors,
    }
