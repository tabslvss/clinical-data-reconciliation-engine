"""
PyHealth adapter — bridges our Pydantic models and pyhealth.data structures.

Requests are converted into pyhealth.data.Patient objects (backed by a
polars DataFrame) so that the reconciliation and data-quality engines can
iterate over standardised Event objects rather than raw dicts.

Column naming convention follows the PyHealth from_dict() contract:
    {event_type}/{attribute_name}
e.g.  medication/name, medication/system, diagnosis/code
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

import polars as pl
from pyhealth.data import Event, Patient

from app.models.medication import (
    MedicationReconcileRequest,
    MedicationSource,
    PatientContext,
)
from app.models.data_quality import DataQualityRequest, Demographics, VitalSigns


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _parse_date(date_str: Optional[str]) -> datetime:
    """Parse a date string to datetime; fall back to datetime.now()."""
    if not date_str:
        return datetime.now()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return datetime.now()


# ─────────────────────────────────────────────────────────────
# Reconcile: Pydantic → PyHealth Patient
# ─────────────────────────────────────────────────────────────

def build_reconcile_patient(
    request: MedicationReconcileRequest,
    patient_id: str = "patient_reconcile",
) -> Patient:
    """
    Convert a MedicationReconcileRequest into a pyhealth Patient.

    Event types produced:
      - "medication"       — one per MedicationSource
      - "patient_context"  — one for the PatientContext
    """
    med_rows = [
        {
            "event_type": "medication",
            "timestamp": _parse_date(s.last_updated or s.last_filled),
            "medication/name": s.medication,
            "medication/system": s.system,
            "medication/reliability": s.source_reliability,
            "medication/last_updated": s.last_updated or "",
            "medication/last_filled": s.last_filled or "",
            "medication/notes": s.notes or "",
        }
        for s in request.sources
    ]

    ctx = request.patient_context
    egfr = str((ctx.recent_labs or {}).get("eGFR", (ctx.recent_labs or {}).get("egfr", "")))
    ctx_rows = [
        {
            "event_type": "patient_context",
            "timestamp": datetime.now(),
            "patient_context/age": str(ctx.age or ""),
            "patient_context/conditions": ",".join(ctx.conditions or []),
            "patient_context/egfr": egfr,
            "patient_context/allergies": ",".join(ctx.allergies or []),
        }
    ]

    df = pl.concat(
        [pl.DataFrame(med_rows), pl.DataFrame(ctx_rows)],
        how="diagonal_relaxed",
    )
    return Patient(patient_id=patient_id, data_source=df)


# ─────────────────────────────────────────────────────────────
# Reconcile: PyHealth Patient → Pydantic models
# ─────────────────────────────────────────────────────────────

def extract_reconcile_models(
    patient: Patient,
) -> tuple[list[MedicationSource], PatientContext]:
    """
    Reconstruct a list of MedicationSource objects and a PatientContext
    from the events stored in a PyHealth Patient.
    """
    med_events: list[Event] = patient.get_events(event_type="medication")
    sources = [
        MedicationSource(
            system=ev.attr_dict.get("system", "Unknown"),
            medication=ev.attr_dict.get("name", ""),
            last_updated=ev.attr_dict.get("last_updated") or None,
            last_filled=ev.attr_dict.get("last_filled") or None,
            source_reliability=ev.attr_dict.get("reliability", "medium"),
            notes=ev.attr_dict.get("notes") or None,
        )
        for ev in med_events
    ]

    ctx_events: list[Event] = patient.get_events(event_type="patient_context")
    if ctx_events:
        attrs = ctx_events[0].attr_dict
        age_str = attrs.get("age", "")
        egfr_str = attrs.get("egfr", "")
        conditions_str = attrs.get("conditions", "")
        allergies_str = attrs.get("allergies", "")
        context = PatientContext(
            age=int(age_str) if age_str else None,
            conditions=[c for c in conditions_str.split(",") if c],
            recent_labs={"eGFR": float(egfr_str)} if egfr_str else {},
            allergies=[a for a in allergies_str.split(",") if a],
        )
    else:
        context = PatientContext()

    return sources, context


# ─────────────────────────────────────────────────────────────
# Data quality: Pydantic → PyHealth Patient
# ─────────────────────────────────────────────────────────────

def build_quality_patient(
    request: DataQualityRequest,
    patient_id: str = "patient_quality",
) -> Patient:
    """
    Convert a DataQualityRequest into a pyhealth Patient.

    Event types produced:
      - "medication"   — one per medication string
      - "diagnosis"    — one per condition string
      - "allergy"      — one per allergy string
      - "vital_sign"   — one (blood pressure + heart rate)
      - "demographic"  — one (name, dob, gender)
      - "record_meta"  — one (last_updated timestamp)
    """
    all_dfs: list[pl.DataFrame] = []

    # Medications
    if request.medications:
        all_dfs.append(pl.DataFrame([
            {
                "event_type": "medication",
                "timestamp": _parse_date(request.last_updated),
                "medication/name": med,
            }
            for med in request.medications
        ]))

    # Diagnoses / conditions
    if request.conditions:
        all_dfs.append(pl.DataFrame([
            {
                "event_type": "diagnosis",
                "timestamp": _parse_date(request.last_updated),
                "diagnosis/description": cond,
            }
            for cond in request.conditions
        ]))

    # Allergies
    if request.allergies is not None:
        if request.allergies:
            all_dfs.append(pl.DataFrame([
                {
                    "event_type": "allergy",
                    "timestamp": _parse_date(request.last_updated),
                    "allergy/substance": allergen,
                }
                for allergen in request.allergies
            ]))
        else:
            # Explicitly documented "no known allergies" — still record the intent
            all_dfs.append(pl.DataFrame([{
                "event_type": "allergy",
                "timestamp": _parse_date(request.last_updated),
                "allergy/substance": "NKDA",
            }]))

    # Vital signs
    if request.vital_signs:
        vs = request.vital_signs
        all_dfs.append(pl.DataFrame([{
            "event_type": "vital_sign",
            "timestamp": _parse_date(request.last_updated),
            "vital_sign/blood_pressure": vs.blood_pressure or "",
            "vital_sign/heart_rate": str(vs.heart_rate or ""),
            "vital_sign/oxygen_saturation": str(vs.oxygen_saturation or ""),
            "vital_sign/temperature": str(vs.temperature or ""),
            "vital_sign/respiratory_rate": str(vs.respiratory_rate or ""),
        }]))

    # Demographics
    if request.demographics:
        dem = request.demographics
        all_dfs.append(pl.DataFrame([{
            "event_type": "demographic",
            "timestamp": _parse_date(request.last_updated),
            "demographic/name": dem.name or "",
            "demographic/dob": dem.dob or "",
            "demographic/gender": dem.gender or "",
        }]))

    # Record metadata
    all_dfs.append(pl.DataFrame([{
        "event_type": "record_meta",
        "timestamp": _parse_date(request.last_updated),
        "record_meta/last_updated": request.last_updated or "",
    }]))

    # Guard: if nothing produced a DataFrame yet, add an empty sentinel
    if not all_dfs:
        all_dfs.append(pl.DataFrame([{
            "event_type": "record_meta",
            "timestamp": datetime.now(),
            "record_meta/last_updated": "",
        }]))

    df = pl.concat(all_dfs, how="diagonal_relaxed")
    return Patient(patient_id=patient_id, data_source=df)


# ─────────────────────────────────────────────────────────────
# Data quality: PyHealth Patient → Pydantic model
# ─────────────────────────────────────────────────────────────

def extract_quality_request(patient: Patient) -> DataQualityRequest:
    """
    Reconstruct a DataQualityRequest from the events stored in a PyHealth Patient.
    This is the inverse of build_quality_patient().
    """
    # Medications
    med_events: list[Event] = patient.get_events(event_type="medication")
    medications = [ev.attr_dict.get("name", "") for ev in med_events] or None

    # Diagnoses
    diag_events: list[Event] = patient.get_events(event_type="diagnosis")
    conditions = [ev.attr_dict.get("description", "") for ev in diag_events] or None

    # Allergies
    allergy_events: list[Event] = patient.get_events(event_type="allergy")
    if allergy_events:
        raw = [ev.attr_dict.get("substance", "") for ev in allergy_events]
        # Filter out the NKDA sentinel — NKDA means an empty list
        allergies: list[str] | None = [a for a in raw if a != "NKDA"]
    else:
        allergies = None

    # Vital signs
    vs_events: list[Event] = patient.get_events(event_type="vital_sign")
    vital_signs: VitalSigns | None = None
    if vs_events:
        attrs = vs_events[0].attr_dict
        vital_signs = VitalSigns(
            blood_pressure=attrs.get("blood_pressure") or None,
            heart_rate=int(attrs["heart_rate"]) if attrs.get("heart_rate") else None,
            oxygen_saturation=float(attrs["oxygen_saturation"]) if attrs.get("oxygen_saturation") else None,
            temperature=float(attrs["temperature"]) if attrs.get("temperature") else None,
            respiratory_rate=int(attrs["respiratory_rate"]) if attrs.get("respiratory_rate") else None,
        )

    # Demographics
    dem_events: list[Event] = patient.get_events(event_type="demographic")
    demographics: Demographics | None = None
    if dem_events:
        attrs = dem_events[0].attr_dict
        demographics = Demographics(
            name=attrs.get("name") or None,
            dob=attrs.get("dob") or None,
            gender=attrs.get("gender") or None,
        )

    # Record metadata
    meta_events: list[Event] = patient.get_events(event_type="record_meta")
    last_updated: str | None = None
    if meta_events:
        raw_lu = meta_events[0].attr_dict.get("last_updated", "")
        last_updated = raw_lu if raw_lu else None

    return DataQualityRequest(
        demographics=demographics,
        medications=medications,
        allergies=allergies,
        conditions=conditions,
        vital_signs=vital_signs,
        last_updated=last_updated,
    )
