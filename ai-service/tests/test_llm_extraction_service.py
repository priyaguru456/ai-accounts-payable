import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

import app.services.llm_extraction_service as extraction
from app.schemas.extraction import ExtractedInvoiceData, InvoiceLineItem


def make_data(**overrides):
    defaults = dict(
        vendor_name="Acme Corp",
        invoice_number="INV-1",
        invoice_date="2026-01-01",
        due_date=None,
        currency="USD",
        subtotal=100.0,
        tax_amount=10.0,
        total_amount=110.0,
        line_items=[InvoiceLineItem(description="Widget", quantity=1, unit_price=100.0, amount=100.0)],
    )
    defaults.update(overrides)
    return ExtractedInvoiceData(**defaults)


# --- _parse_json_block -------------------------------------------------------------

def test_parse_json_block_extracts_json_from_surrounding_text():
    text = 'Here is the result:\n{"a": 1, "b": [2, 3]}\nThanks.'
    assert extraction._parse_json_block(text) == {"a": 1, "b": [2, 3]}


def test_parse_json_block_raises_when_no_json_present():
    with pytest.raises(ValueError):
        extraction._parse_json_block("no json here at all")


# --- _numeric_cross_check_passed -----------------------------------------------------

def test_cross_check_passes_when_totals_and_line_items_agree():
    assert extraction._numeric_cross_check_passed(make_data()) is True


def test_cross_check_fails_when_subtotal_plus_tax_does_not_match_total():
    data = make_data(total_amount=999.0)
    assert extraction._numeric_cross_check_passed(data) is False


def test_cross_check_fails_when_line_items_do_not_sum_to_subtotal():
    data = make_data(line_items=[InvoiceLineItem(description="Widget", quantity=1, unit_price=5.0, amount=5.0)])
    assert extraction._numeric_cross_check_passed(data) is False


def test_cross_check_fails_when_required_totals_are_missing():
    data = make_data(subtotal=None)
    assert extraction._numeric_cross_check_passed(data) is False


# --- _composite_confidence -----------------------------------------------------------

def test_composite_confidence_is_high_for_clean_extraction():
    confidence = extraction._composite_confidence(1.0, make_data())
    assert confidence > 0.9


def test_composite_confidence_drops_for_incomplete_fields_and_failed_cross_check():
    sparse = make_data(vendor_name=None, invoice_number=None, total_amount=999.0)
    confidence = extraction._composite_confidence(0.5, sparse)
    assert confidence < 0.5


# --- _call_model model-chain fallback -------------------------------------------------

class FakeTextBlock:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class FakeResponse:
    def __init__(self, text):
        self.content = [FakeTextBlock(text)]


@pytest.mark.asyncio
async def test_call_model_falls_back_to_second_model_when_first_fails(monkeypatch):
    calls = []

    async def fake_create(*, model, **kwargs):
        calls.append(model)
        if model == extraction.MODEL_CHAIN[0]:
            raise RuntimeError("primary model unavailable")
        return FakeResponse('{"ok": true}')

    fake_client = type("FakeClient", (), {"messages": type("M", (), {"create": staticmethod(fake_create)})()})()
    monkeypatch.setattr(extraction, "_get_client", lambda: fake_client)

    raw, model_used = await extraction._call_model("system", "prompt")

    assert raw == {"ok": True}
    assert model_used == extraction.MODEL_CHAIN[1]
    assert calls == [extraction.MODEL_CHAIN[0], extraction.MODEL_CHAIN[1]]


@pytest.mark.asyncio
async def test_call_model_raises_when_every_model_in_chain_fails(monkeypatch):
    async def fake_create(*, model, **kwargs):
        raise RuntimeError(f"{model} is down")

    fake_client = type("FakeClient", (), {"messages": type("M", (), {"create": staticmethod(fake_create)})()})()
    monkeypatch.setattr(extraction, "_get_client", lambda: fake_client)

    with pytest.raises(RuntimeError, match="All models in chain failed"):
        await extraction._call_model("system", "prompt")


# --- extract_invoice_fields: retry, RAG, and re-verification ------------------------

@pytest.mark.asyncio
async def test_extract_invoice_fields_retries_once_then_succeeds(monkeypatch):
    monkeypatch.setattr(extraction.rag_service, "retrieve_examples", lambda *a, **k: [])

    call_count = {"n": 0}

    async def fake_call_model(system, prompt):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise ValueError("malformed JSON")
        return make_data().model_dump(), "claude-sonnet-5"

    monkeypatch.setattr(extraction, "_call_model", fake_call_model)

    parsed, confidence, elapsed_ms, model_used = await extraction.extract_invoice_fields("ocr text", 0.9)

    assert call_count["n"] == 2
    assert parsed.invoice_number == "INV-1"
    assert confidence > 0
    assert model_used == "claude-sonnet-5"


@pytest.mark.asyncio
async def test_extract_invoice_fields_raises_after_exhausting_retries(monkeypatch):
    monkeypatch.setattr(extraction.rag_service, "retrieve_examples", lambda *a, **k: [])

    async def always_fails(system, prompt):
        raise ValueError("still malformed")

    monkeypatch.setattr(extraction, "_call_model", always_fails)

    with pytest.raises(RuntimeError, match="LLM extraction failed after retries"):
        await extraction.extract_invoice_fields("ocr text", 0.9)


@pytest.mark.asyncio
async def test_low_confidence_triggers_reverification_and_uses_improved_result(monkeypatch):
    monkeypatch.setattr(extraction.rag_service, "retrieve_examples", lambda *a, **k: [])
    monkeypatch.setattr(extraction.settings, "reverification_threshold", 0.99)  # force the branch

    first_pass = make_data(vendor_name=None, invoice_number=None)  # low completeness -> low confidence
    reverified = make_data()  # complete -> high confidence

    calls = {"n": 0}

    async def fake_call_model(system, prompt):
        calls["n"] += 1
        if calls["n"] == 1:
            return first_pass.model_dump(), "claude-sonnet-5"
        return reverified.model_dump(), "claude-sonnet-5"

    monkeypatch.setattr(extraction, "_call_model", fake_call_model)

    parsed, confidence, elapsed_ms, model_used = await extraction.extract_invoice_fields("ocr text", 0.9)

    assert calls["n"] == 2  # first pass + one re-verification pass
    assert parsed.vendor_name == "Acme Corp"  # took the reverified, better result


@pytest.mark.asyncio
async def test_reverification_failure_keeps_first_pass_result(monkeypatch):
    monkeypatch.setattr(extraction.rag_service, "retrieve_examples", lambda *a, **k: [])
    monkeypatch.setattr(extraction.settings, "reverification_threshold", 0.99)

    first_pass = make_data(vendor_name=None, invoice_number=None)

    calls = {"n": 0}

    async def fake_call_model(system, prompt):
        calls["n"] += 1
        if calls["n"] == 1:
            return first_pass.model_dump(), "claude-sonnet-5"
        raise RuntimeError("re-verification call failed")

    monkeypatch.setattr(extraction, "_call_model", fake_call_model)

    parsed, confidence, elapsed_ms, model_used = await extraction.extract_invoice_fields("ocr text", 0.9)

    # Re-verification blew up, but extract_invoice_fields must not raise — it keeps
    # the first-pass result rather than losing the extraction entirely.
    assert parsed.vendor_name is None
    assert parsed.invoice_number is None
