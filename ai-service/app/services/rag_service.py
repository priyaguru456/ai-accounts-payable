import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Optional

from app.core.logging import get_logger

logger = get_logger(__name__)

# Lightweight, dependency-free RAG store: a local JSON file of prior *approved*
# extractions per vendor, retrieved by TF-IDF cosine similarity over the raw OCR text.
# This intentionally avoids requiring pgvector/OpenSearch/an embeddings API — none of
# which are set up — while still giving the extraction prompt few-shot examples of a
# given vendor's known invoice layout, which is where RAG earns its keep here.
STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "vendor_invoice_examples.json"
MAX_EXAMPLES_PER_VENDOR = 20
TOP_K = 2


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _tf_vector(tokens: list[str]) -> Counter:
    return Counter(tokens)


def _cosine_similarity(a: Counter, b: Counter) -> float:
    common = set(a) & set(b)
    dot = sum(a[t] * b[t] for t in common)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _load_store() -> dict:
    if not STORE_PATH.exists():
        return {}
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as err:
        logger.warning("Failed to load RAG store, starting fresh: %s", err)
        return {}


def _save_store(store: dict) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def add_example(vendor_id: str, ocr_text: str, extracted_data: dict) -> None:
    """Call this when an invoice is approved, so future extractions for the same
    vendor can be few-shot primed with a known-good example of their layout."""
    store = _load_store()
    examples = store.setdefault(vendor_id, [])
    examples.append({"ocr_text": ocr_text, "extracted_data": extracted_data})
    store[vendor_id] = examples[-MAX_EXAMPLES_PER_VENDOR:]
    _save_store(store)


def retrieve_examples(vendor_id: Optional[str], ocr_text: str, top_k: int = TOP_K) -> list[dict]:
    if not vendor_id:
        return []
    store = _load_store()
    examples = store.get(vendor_id, [])
    if not examples:
        return []

    query_vec = _tf_vector(_tokenize(ocr_text))
    scored = [
        (example, _cosine_similarity(query_vec, _tf_vector(_tokenize(example["ocr_text"]))))
        for example in examples
    ]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return [example for example, score in scored[:top_k] if score > 0.05]
