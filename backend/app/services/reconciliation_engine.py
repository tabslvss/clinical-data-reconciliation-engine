"""
Rule-based reconciliation engine.
This layer deterministically picks the best source BEFORE any AI call.
AI is only used afterwards to generate human-readable reasoning.

PyHealth integration:
  reconcile_from_patient() accepts a pyhealth.data.Patient that was built
  by pyhealth_adapter.build_reconcile_patient().  It extracts the Event
  objects, reconstructs the Pydantic models, and delegates to the core
  reconcile_medications() logic so all business rules run unchanged.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from app.models.medication import MedicationSource, PatientContext

if TYPE_CHECKING:
    from pyhealth.data import Patient

RELIABILITY_SCORE = {"high": 3, "medium": 2, "low": 1}


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def _recency_score(source: MedicationSource) -> float:
    """Return a 0-1 recency score (1 = today, decays over 365 days)."""
    date_str = source.last_updated or source.last_filled
    parsed = _parse_date(date_str)
    if not parsed:
        return 0.0
    days_ago = max((datetime.now() - parsed).days, 0)
    return max(1.0 - days_ago / 730.0, 0.0)


def _clinical_adjustment(source: MedicationSource, context: PatientContext) -> float:
    """
    Apply clinical context rules.
    Returns a small bonus/penalty (-0.2 to +0.2).
    """
    adjustment = 0.0
    medication_lower = source.medication.lower()
    conditions_lower = [c.lower() for c in (context.conditions or [])]
    labs = context.recent_labs or {}
    egfr = labs.get("eGFR") or labs.get("egfr")

    # Metformin + low eGFR: prefer lower dose
    if "metformin" in medication_lower and egfr is not None:
        try:
            egfr_val = float(egfr)
            if egfr_val < 30:
                # Metformin contraindicated below eGFR 30 — penalise any record keeping it
                adjustment -= 0.2
            elif egfr_val < 45:
                # Prefer lower dose; penalise 1000 mg twice daily
                if "1000mg" in medication_lower and "twice" in medication_lower:
                    adjustment -= 0.15
                elif "500mg" in medication_lower:
                    adjustment += 0.1
        except (ValueError, TypeError):
            pass

    # NSAIDs + CKD
    nsaid_keywords = ["ibuprofen", "naproxen", "celecoxib", "indomethacin"]
    if any(k in medication_lower for k in nsaid_keywords):
        if "ckd" in conditions_lower or "chronic kidney disease" in conditions_lower:
            adjustment -= 0.2
        if egfr is not None:
            try:
                if float(egfr) < 30:
                    adjustment -= 0.2
            except (ValueError, TypeError):
                pass

    return adjustment


def score_source(source: MedicationSource, context: PatientContext) -> float:
    reliability = RELIABILITY_SCORE.get(source.source_reliability.lower(), 1) / 3.0
    recency = _recency_score(source)
    clinical = _clinical_adjustment(source, context)
    raw = (recency * 0.4) + (reliability * 0.4) + (clinical * 0.2)
    # Clamp to [0, 1]
    return max(0.0, min(raw, 1.0))


def reconcile_medications(
    sources: list[MedicationSource], context: PatientContext
) -> tuple[MedicationSource, float, list[float]]:
    """
    Returns (best_source, confidence_score, all_scores).
    """
    scores = [score_source(s, context) for s in sources]
    best_idx = scores.index(max(scores))
    best_source = sources[best_idx]
    best_score = scores[best_idx]

    # Agreement bonus: if multiple sources agree on medication name, boost confidence
    med_names = [s.medication.lower().split()[0] for s in sources]
    agreement_count = med_names.count(med_names[best_idx])
    agreement_bonus = min((agreement_count - 1) * 0.05, 0.1)

    confidence = min(best_score + agreement_bonus, 0.95)
    return best_source, round(confidence, 2), scores


def build_conflict_summary(sources: list[MedicationSource]) -> str:
    lines = [f"- {s.system}: {s.medication} (reliability: {s.source_reliability})" for s in sources]
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────
# PyHealth entry point
# ─────────────────────────────────────────────────────────────

def reconcile_from_patient(
    patient: "Patient",
) -> tuple[MedicationSource, float, list[float]]:
    """
    Run medication reconciliation directly from a pyhealth.data.Patient.

    The Patient must have been built with
    ``pyhealth_adapter.build_reconcile_patient()``.  This function
    extracts the structured Event objects, reconstructs the domain
    Pydantic models, and delegates to the core reconcile_medications()
    function so every business rule is exercised on standardised data.

    Returns (best_source, confidence_score, all_scores).
    """
    from app.services.pyhealth_adapter import extract_reconcile_models

    sources, context = extract_reconcile_models(patient)
    return reconcile_medications(sources, context)
