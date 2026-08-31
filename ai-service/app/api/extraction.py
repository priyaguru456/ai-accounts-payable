from fastapi import APIRouter, Depends, HTTPException

from app.core.security import verify_internal_key
from app.core.logging import get_logger
from app.schemas.extraction import AddExampleRequest, ExtractRequest, ExtractResponse
from app.services import llm_extraction_service, ocr_service, rag_service

router = APIRouter(dependencies=[Depends(verify_internal_key)])
logger = get_logger(__name__)


@router.post("/extract", response_model=ExtractResponse, response_model_by_alias=True)
async def extract(request: ExtractRequest) -> ExtractResponse:
    try:
        document_bytes = await ocr_service.fetch_document(request.document_url)
    except Exception as err:  # noqa: BLE001
        logger.error("Failed to fetch document: %s", err)
        raise HTTPException(status_code=502, detail=f"Could not fetch document: {err}") from err

    ocr_text, ocr_confidence = ocr_service.run_ocr(document_bytes)

    if not ocr_text.strip():
        raise HTTPException(status_code=422, detail="OCR produced no readable text from the document")

    try:
        extracted_data, confidence, elapsed_ms, model_used = await llm_extraction_service.extract_invoice_fields(
            ocr_text, ocr_confidence, vendor_id=request.vendor_id
        )
    except Exception as err:  # noqa: BLE001
        logger.error("LLM extraction failed: %s", err)
        raise HTTPException(status_code=502, detail=f"Extraction failed: {err}") from err

    return ExtractResponse(
        extractedData=extracted_data,
        confidence=confidence,
        modelName=model_used,
        processingTimeMs=elapsed_ms,
        ocrText=ocr_text,
    )


@router.post("/rag/examples", status_code=204)
async def add_example(request: AddExampleRequest) -> None:
    """Called by the backend when an invoice is approved, to seed the per-vendor RAG
    store with a known-good extraction example for that vendor's layout."""
    rag_service.add_example(request.vendor_id, request.ocr_text, request.extracted_data)
