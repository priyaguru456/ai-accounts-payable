import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.risk_service import assess_risk, score_to_level


def test_low_risk_when_all_signals_clean():
    score, level, reasons = assess_risk(
        invoice={"totalAmount": 500},
        extraction={"confidence": 0.95},
        match_status="MATCHED",
        duplicate_count=0,
    )
    assert level == "LOW"
    assert score == 0
    assert reasons == ["No risk indicators detected"]


def test_critical_risk_when_mismatched_and_duplicate_and_low_confidence():
    score, level, reasons = assess_risk(
        invoice={"totalAmount": 2_000_000},
        extraction={"confidence": 0.3},
        match_status="MISMATCHED",
        duplicate_count=2,
    )
    assert level == "CRITICAL"
    assert score == 100
    assert len(reasons) == 4


def test_score_to_level_boundaries():
    assert score_to_level(0) == "LOW"
    assert score_to_level(25) == "MEDIUM"
    assert score_to_level(50) == "HIGH"
    assert score_to_level(75) == "CRITICAL"
