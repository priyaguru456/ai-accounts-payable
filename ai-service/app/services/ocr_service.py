import io

import httpx
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

from app.core.logging import get_logger

logger = get_logger(__name__)


async def fetch_document(document_url: str) -> bytes:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(document_url)
        response.raise_for_status()
        return response.content


def run_ocr(document_bytes: bytes, content_type: str = "") -> tuple[str, float]:
    """Returns (raw_text, mean_word_confidence in [0, 1])."""
    if "pdf" in content_type.lower() or document_bytes[:4] == b"%PDF":
        pages = convert_from_bytes(document_bytes)
    else:
        pages = [Image.open(io.BytesIO(document_bytes))]

    texts = []
    confidences = []

    for page in pages:
        data = pytesseract.image_to_data(page, output_type=pytesseract.Output.DICT)
        texts.append(" ".join(w for w in data["text"] if w.strip()))
        word_confidences = [int(c) for c in data["conf"] if c not in ("-1", -1)]
        if word_confidences:
            confidences.extend(word_confidences)

    raw_text = "\n".join(texts)
    mean_confidence = (sum(confidences) / len(confidences) / 100) if confidences else 0.0
    return raw_text, mean_confidence
