from fastapi import APIRouter, Depends

from app.core.security import verify_internal_key
from app.schemas.risk import RiskAssessRequest, RiskAssessResponse
from app.services.risk_service import assess_risk

router = APIRouter(dependencies=[Depends(verify_internal_key)])


@router.post("/assess-risk", response_model=RiskAssessResponse, response_model_by_alias=True)
async def assess_risk_endpoint(request: RiskAssessRequest) -> RiskAssessResponse:
    score, level, reasons = assess_risk(
        request.invoice, request.extraction, request.match_status, request.duplicate_count
    )
    return RiskAssessResponse(riskScore=score, riskLevel=level, reasons=reasons, modelName="risk-rules-v1")
