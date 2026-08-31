import json

EXTRACTION_SYSTEM_PROMPT = """You are an invoice data extraction engine. You are given raw OCR text from a \
scanned or digital invoice. Extract the following fields and return ONLY valid JSON matching this exact \
shape, with no prose, no markdown fences:

{
  "vendor_name": string | null,
  "invoice_number": string | null,
  "invoice_date": string | null (ISO 8601 date, e.g. "2026-08-31"),
  "due_date": string | null (ISO 8601 date),
  "currency": string | null (ISO 4217 code, e.g. "INR", "USD"),
  "subtotal": number | null,
  "tax_amount": number | null,
  "total_amount": number | null,
  "line_items": [
    { "description": string, "quantity": number, "unit_price": number, "amount": number }
  ]
}

Rules:
- If a field cannot be determined from the text, use null (or an empty list for line_items) rather than guessing.
- Numbers must be plain numbers, no currency symbols or thousands separators.
- Dates must be normalized to ISO 8601 (YYYY-MM-DD).
- Do not invent line items that are not present in the text.
- If prior examples from the same vendor are provided, use them only to understand this vendor's
  typical layout/field placement — never copy their values into the new extraction.
"""

RE_VERIFICATION_SYSTEM_PROMPT = """You are re-verifying a previous, low-confidence invoice extraction. \
You are given the OCR text and the first-pass JSON extraction. Check each field against the OCR text and \
return a corrected JSON extraction in the exact same shape as the first pass. If a field was correct, keep \
it. If a field was wrong or missing but is present in the OCR text, fix it. If it truly cannot be \
determined, use null. Return ONLY the corrected JSON, no prose."""


def build_extraction_prompt(ocr_text: str, examples: list[dict] | None = None) -> str:
    examples_block = ""
    if examples:
        rendered = "\n\n".join(
            f"Example OCR text:\n{ex['ocr_text'][:1500]}\n\nExample extraction:\n{json.dumps(ex['extracted_data'])}"
            for ex in examples
        )
        examples_block = (
            f"PRIOR APPROVED EXAMPLES FROM THIS VENDOR (for layout reference only):\n---\n{rendered}\n---\n\n"
        )

    return f"{examples_block}OCR TEXT:\n---\n{ocr_text}\n---\n\nReturn the JSON extraction now."


def build_reverification_prompt(ocr_text: str, first_pass_json: dict) -> str:
    return (
        f"OCR TEXT:\n---\n{ocr_text}\n---\n\n"
        f"FIRST-PASS EXTRACTION:\n{json.dumps(first_pass_json)}\n\n"
        "Return the corrected JSON extraction now."
    )
