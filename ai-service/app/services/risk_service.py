from typing import Any

RISK_LEVEL_THRESHOLDS = [
    (75, "CRITICAL"),
    (50, "HIGH"),
    (25, "MEDIUM"),
]


def score_to_level(score: float) -> str:
    for threshold, level in RISK_LEVEL_THRESHOLDS:
        if score >= threshold:
            return level
    return "LOW"


def assess_risk(invoice: dict[str, Any], extraction: dict[str, Any], match_status: str, duplicate_count: int) -> tuple[float, str, list[str]]:
    """Deterministic, explainable rule-based risk scoring (0-100). This intentionally
    avoids an opaque LLM judgment for the risk gate itself, since risk decisions must
    be auditable; the LLM is used upstream only for field extraction."""
    score = 0.0
    reasons: list[str] = []

    confidence = extraction.get("confidence") or 0
    if confidence < 0.5:
        score += 30
        reasons.append(f"Very low extraction confidence ({confidence:.2f})")
    elif confidence < 0.75:
        score += 15
        reasons.append(f"Low extraction confidence ({confidence:.2f})")

    if match_status == "MISMATCHED":
        score += 35
        reasons.append("Invoice does not match linked purchase order / goods receipt")
    elif match_status == "PARTIAL":
        score += 15
        reasons.append("Partial PO/goods-receipt match discrepancies found")
    elif match_status == "NOT_CHECKED":
        score += 10
        reasons.append("No purchase order linked to invoice")

    if duplicate_count > 0:
        score += 30
        reasons.append(f"{duplicate_count} similar invoice(s) found for this vendor near the same date/amount")

    total_amount = invoice.get("totalAmount") or 0
    if total_amount > 1_000_000:
        score += 10
        reasons.append("High-value invoice (> 1,000,000)")

    score = min(score, 100)
    if not reasons:
        reasons.append("No risk indicators detected")

    return score, score_to_level(score), reasons
