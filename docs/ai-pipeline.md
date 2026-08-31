# AI Pipeline

## LLM
Anthropic Claude (model configurable via `LLM_MODEL`, default `claude-sonnet-5`), called only from
`ai-service`. Used solely for structured field extraction from OCR text — never for the risk/approval
decision itself, which is a deterministic, auditable rule engine (`app/services/risk_service.py`).

## OCR
`pytesseract` (Tesseract) + `pdf2image` for PDFs. Pluggable behind `app/services/ocr_service.py` so
AWS Textract can be swapped in for production without touching callers.

## RAG
Not required for MVP correctness (the extraction prompt is schema-driven, not knowledge-driven).
Planned as a phase-3 enhancement: a small vector store of prior invoices per vendor to improve
field-layout consistency, referenced from `llm_extraction_service.py` as an additional prompt-context
step.

## Agents / workflow
A deterministic pipeline, not an autonomous agent loop: OCR -> LLM extract -> validate -> score.
A future "agentic" mode can add a tool-using reviewer step only when confidence is low (re-OCR,
cross-check vendor DB) — kept out of MVP to keep behavior predictable and auditable.

## Tools
`lookup_vendor`, `parse_currency`, `normalize_date` are named as extraction-support tools in the
plan; MVP implements normalization directly in the prompt/schema layer. Promote them to actual
LLM tool-calls if extraction accuracy on messy OCR text needs improvement later.

## Prompts
Versioned under `ai-service/app/util/prompt_templates/`. `invoice_extraction.py` defines the system
prompt and the exact output JSON schema the model must return.

## Validation
Every LLM response is parsed as JSON and validated against `ExtractedInvoiceData` (pydantic). A
failed parse/validation retries once. A numeric cross-check (`_numeric_cross_check_passed`) verifies
subtotal + tax ≈ total and line items sum ≈ subtotal.

## Confidence scoring
Composite score = `0.4 * OCR word confidence + 0.3 * field completeness + 0.3 * numeric cross-check
pass/fail` (`llm_extraction_service.py`). Below `CONFIDENCE_THRESHOLD` (default 0.75), the invoice is
forced into `PENDING_REVIEW` regardless of any other signal.

## Human-in-the-loop
`processInvoice.js` never auto-approves. Any of: low confidence, `HIGH`/`CRITICAL` risk, fuzzy
duplicate match, or a `MISMATCHED` PO/GR match forces `PENDING_REVIEW`; everything else still
requires a human `PENDING_APPROVAL` action before payment.

## Security
- `ai-service` never touches the DB and is unreachable from the public internet.
- All backend/worker -> ai-service calls carry `X-Internal-Key`.
- No invoice PII is logged; only structured metadata (confidence, model name, timing).

## Failure handling
`backend/src/services/aiServiceClient.js` wraps every AI call with a bounded retry (`withRetry`,
2 attempts). On persistent failure, `processInvoice.js` records the error on `AIExtraction` and
routes the invoice to `PENDING_REVIEW` for manual data entry rather than leaving it stuck in
`PROCESSING` or silently failing.
