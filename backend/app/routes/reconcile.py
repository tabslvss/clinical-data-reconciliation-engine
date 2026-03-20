from fastapi import APIRouter, Depends, HTTPException
from app.models.medication import MedicationReconcileRequest, MedicationReconcileResponse
from app.services.reconciliation_engine import reconcile_medications, build_conflict_summary
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

    best_source, confidence, scores = reconcile_medications(
        payload.sources, payload.patient_context
    )

    conflict_summary = build_conflict_summary(payload.sources)

    all_sources_dict = [s.model_dump() for s in payload.sources]
    context_dict = payload.patient_context.model_dump()

    ai_result = get_reconciliation_reasoning(
        reconciled_medication=best_source.medication,
        all_sources=all_sources_dict,
        patient_context=context_dict,
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
