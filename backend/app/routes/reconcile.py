from fastapi import APIRouter, Depends, HTTPException

from app.models.medication import MedicationReconcileRequest, MedicationReconcileResponse
from app.services.pyhealth_adapter import build_reconcile_patient
from app.services.reconciliation_engine import reconcile_from_patient, build_conflict_summary
from app.services.ai_service import get_reconciliation_reasoning
from app.utils.auth import get_api_key

router = APIRouter()


@router.post("/medication", response_model=MedicationReconcileResponse)
async def reconcile_medication(
    payload: MedicationReconcileRequest,
    _key: str = Depends(get_api_key),
):
    if not payload.sources:
        raise HTTPException(status_code=422, detail="At least one medication source is required.")

    # Convert the request to a pyhealth Patient (polars-backed Event store)
    patient = build_reconcile_patient(payload)

    # Run rule-based reconciliation through the PyHealth patient
    best_source, confidence, _scores = reconcile_from_patient(patient)

    conflict_summary = build_conflict_summary(payload.sources)

    ai_result = get_reconciliation_reasoning(
        reconciled_medication=best_source.medication,
        all_sources=[s.model_dump() for s in payload.sources],
        patient_context=payload.patient_context.model_dump(),
        confidence_score=confidence,
    )

    return MedicationReconcileResponse(
        reconciled_medication=best_source.medication,
        confidence_score=confidence,
        reasoning=ai_result.get("reasoning", ""),
        recommended_actions=ai_result.get("recommended_actions", []),
        clinical_safety_check=ai_result.get("clinical_safety_check", "WARNING"),
        source_used=best_source.system,
        conflict_summary=conflict_summary,
    )
