import json
import re
import time

from anthropic import AsyncAnthropic

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.extraction import ExtractedInvoiceData
from app.services import rag_service
from app.util.prompt_templates.invoice_extraction import (
    EXTRACTION_SYSTEM_PROMPT,
    RE_VERIFICATION_SYSTEM_PROMPT,
    build_extraction_prompt,
    build_reverification_prompt,
)

logger = get_logger(__name__)

_client: AsyncAnthropic | None = None

# Multi-model resilience: try the primary model first, then a fallback model, so a
# single provider/model outage doesn't stop invoice processing entirely.
MODEL_CHAIN = [settings.llm_model, settings.llm_fallback_model]


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _parse_json_block(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("LLM response did not contain a JSON object")
    return json.loads(match.group(0))


def _numeric_cross_check_passed(data: ExtractedInvoiceData) -> bool:
    if data.subtotal is None or data.tax_amount is None or data.total_amount is None:
        return False
    expected_total = round(data.subtotal + data.tax_amount, 2)
    if abs(expected_total - data.total_amount) > max(1.0, data.total_amount * 0.01):
        return False
    if data.line_items:
        items_sum = round(sum(item.amount for item in data.line_items), 2)
        if abs(items_sum - data.subtotal) > max(1.0, data.subtotal * 0.02):
            return False
    return True


async def _call_model(system: str, user_prompt: str) -> tuple[dict, str]:
    """Tries each model in MODEL_CHAIN in order; returns (parsed_json, model_used).
    Raises the last error if every model in the chain fails."""
    client = _get_client()
    last_error: Exception | None = None

    for model in MODEL_CHAIN:
        if not model:
            continue
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = "".join(block.text for block in response.content if block.type == "text")
            return _parse_json_block(text), model
        except Exception as err:  # noqa: BLE001
            last_error = err
            logger.warning("Model %s failed, trying next in chain: %s", model, err)

    raise RuntimeError(f"All models in chain failed: {last_error}")


def _field_completeness(parsed: ExtractedInvoiceData) -> float:
    return sum(
        1
        for v in [parsed.vendor_name, parsed.invoice_number, parsed.invoice_date, parsed.total_amount]
        if v is not None
    ) / 4


def _composite_confidence(ocr_confidence: float, parsed: ExtractedInvoiceData) -> float:
    field_completeness = _field_completeness(parsed)
    cross_check_score = 1.0 if _numeric_cross_check_passed(parsed) else 0.3
    return round((ocr_confidence * 0.4) + (field_completeness * 0.3) + (cross_check_score * 0.3), 4)


async def extract_invoice_fields(
    ocr_text: str, ocr_confidence: float, vendor_id: str | None = None
) -> tuple[ExtractedInvoiceData, float, int, str]:
    """Runs LLM structured extraction over OCR text (RAG-augmented with prior approved
    examples for this vendor, if any), validates the response, and — if confidence is
    still below `reverification_threshold` — runs one bounded agentic re-verification
    pass before returning. Returns (data, composite_confidence, elapsed_ms, model_used)."""
    start = time.monotonic()

    examples = rag_service.retrieve_examples(vendor_id, ocr_text)
    prompt = build_extraction_prompt(ocr_text, examples)

    parsed: ExtractedInvoiceData | None = None
    model_used = "unknown"

    for attempt in range(2):
        try:
            raw, model_used = await _call_model(EXTRACTION_SYSTEM_PROMPT, prompt)
            parsed = ExtractedInvoiceData.model_validate(raw)
            break
        except Exception as err:  # noqa: BLE001
            logger.warning("Extraction attempt %d failed: %s", attempt + 1, err)
            if attempt == 1:
                raise RuntimeError(f"LLM extraction failed after retries: {err}") from err

    confidence = _composite_confidence(ocr_confidence, parsed)

    # Agentic re-verification: a second, bounded pass that re-checks the first pass
    # against the OCR text when confidence is low, before falling back to a human. This
    # never replaces human review for genuinely low-confidence cases — it only recovers
    # the subset where the model can self-correct against text it already has.
    if confidence < settings.reverification_threshold:
        try:
            reverify_prompt = build_reverification_prompt(ocr_text, parsed.model_dump())
            raw, model_used = await _call_model(RE_VERIFICATION_SYSTEM_PROMPT, reverify_prompt)
            reverified = ExtractedInvoiceData.model_validate(raw)
            reverified_confidence = _composite_confidence(ocr_confidence, reverified)
            if reverified_confidence > confidence:
                parsed, confidence = reverified, reverified_confidence
                logger.info("Re-verification improved confidence to %.2f", confidence)
        except Exception as err:  # noqa: BLE001
            logger.warning("Re-verification pass failed, keeping first-pass result: %s", err)

    elapsed_ms = int((time.monotonic() - start) * 1000)
    return parsed, confidence, elapsed_ms, model_used
