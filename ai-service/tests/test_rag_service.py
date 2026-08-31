import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.services.rag_service as rag_service


def test_retrieve_examples_returns_empty_without_vendor_id(tmp_path, monkeypatch):
    monkeypatch.setattr(rag_service, "STORE_PATH", tmp_path / "store.json")
    assert rag_service.retrieve_examples(None, "some ocr text") == []


def test_add_and_retrieve_example_for_same_vendor(tmp_path, monkeypatch):
    monkeypatch.setattr(rag_service, "STORE_PATH", tmp_path / "store.json")

    rag_service.add_example("vendor-1", "Acme Corp Invoice #123 Total: 500", {"invoice_number": "123"})
    rag_service.add_example("vendor-2", "Totally unrelated vendor text about widgets", {"invoice_number": "999"})

    results = rag_service.retrieve_examples("vendor-1", "Acme Corp Invoice #456 Total: 700")

    assert len(results) == 1
    assert results[0]["extracted_data"]["invoice_number"] == "123"


def test_examples_capped_per_vendor(tmp_path, monkeypatch):
    monkeypatch.setattr(rag_service, "STORE_PATH", tmp_path / "store.json")
    monkeypatch.setattr(rag_service, "MAX_EXAMPLES_PER_VENDOR", 3)

    for i in range(5):
        rag_service.add_example("vendor-1", f"invoice number {i} some words", {"invoice_number": str(i)})

    store = rag_service._load_store()
    assert len(store["vendor-1"]) == 3
    assert store["vendor-1"][-1]["extracted_data"]["invoice_number"] == "4"
