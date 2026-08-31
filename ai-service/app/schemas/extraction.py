from typing import Optional

from pydantic import BaseModel, Field


class ExtractRequest(BaseModel):
    document_url: str = Field(..., alias="documentUrl")
    vendor_id: Optional[str] = Field(default=None, alias="vendorId")

    class Config:
        populate_by_name = True


class InvoiceLineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    amount: float


class ExtractedInvoiceData(BaseModel):
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    currency: Optional[str] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    line_items: list[InvoiceLineItem] = []


class ExtractResponse(BaseModel):
    extracted_data: ExtractedInvoiceData = Field(..., alias="extractedData")
    confidence: float
    model_name: str = Field(..., alias="modelName")
    processing_time_ms: int = Field(..., alias="processingTimeMs")
    error_message: Optional[str] = Field(default=None, alias="errorMessage")
    ocr_text: Optional[str] = Field(default=None, alias="ocrText")

    class Config:
        populate_by_name = True


class AddExampleRequest(BaseModel):
    vendor_id: str = Field(..., alias="vendorId")
    ocr_text: str = Field(..., alias="ocrText")
    extracted_data: dict = Field(..., alias="extractedData")

    class Config:
        populate_by_name = True
