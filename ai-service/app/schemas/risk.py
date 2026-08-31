from typing import Any, Optional

from pydantic import BaseModel, Field


class RiskAssessRequest(BaseModel):
    invoice: dict[str, Any]
    extraction: dict[str, Any]
    match_status: str = Field(..., alias="matchStatus")
    duplicate_count: int = Field(..., alias="duplicateCount")

    class Config:
        populate_by_name = True


class RiskAssessResponse(BaseModel):
    risk_score: float = Field(..., alias="riskScore")
    risk_level: str = Field(..., alias="riskLevel")
    reasons: list[str]
    model_name: Optional[str] = Field(default=None, alias="modelName")

    class Config:
        populate_by_name = True
