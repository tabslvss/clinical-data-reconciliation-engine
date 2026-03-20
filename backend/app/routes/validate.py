from fastapi import APIRouter, Depends

from app.models.data_quality import DataQualityRequest, DataQualityResponse, QualityBreakdown, QualityIssue
from app.services.pyhealth_adapter import build_quality_patient
from app.services.data_quality_engine import score_quality_from_patient
from app.services.ai_service import get_quality_insights
from app.utils.auth import get_api_key

router = APIRouter()


@router.post("/data-quality", response_model=DataQualityResponse)
async def validate_data_quality(
    payload: DataQualityRequest,
    _key: str = Depends(get_api_key),
):
    # Convert the request to a pyhealth Patient (polars-backed Event store)
    patient = build_quality_patient(payload)

    # Run all scoring dimensions through the PyHealth patient
    result = score_quality_from_patient(patient)

    issues_summary = "\n".join(
        f"[{i['severity'].upper()}] {i['field']}: {i['issue']}"
        for i in result["issues_detected"]
    )
    patient_summary = {
        "conditions": payload.conditions,
        "medications_count": len(payload.medications or []),
    }
    ai_insights = get_quality_insights(issues_summary, patient_summary) if issues_summary else ""

    return DataQualityResponse(
        overall_score=result["overall_score"],
        breakdown=QualityBreakdown(**result["breakdown"]),
        issues_detected=[QualityIssue(**i) for i in result["issues_detected"]],
        ai_insights=ai_insights,
    )
