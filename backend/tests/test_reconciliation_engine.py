"""
Unit tests for the rule-based reconciliation engine.
Run with: pytest tests/ -v
"""
import pytest
from app.models.medication import MedicationSource, PatientContext
from app.services.reconciliation_engine import (
    reconcile_medications,
    score_source,
    _recency_score,
)


# ──────────────────────────────────────────────────────────────────
# Test 1: Most recent source wins when reliability is equal
# ──────────────────────────────────────────────────────────────────
def test_most_recent_source_wins():
    sources = [
        MedicationSource(system="Old EHR", medication="Lisinopril 5mg", last_updated="2021-01-01", source_reliability="high"),
        MedicationSource(system="New Clinic", medication="Lisinopril 10mg", last_updated="2026-01-15", source_reliability="high"),
    ]
    context = PatientContext()
    best, confidence, _ = reconcile_medications(sources, context)
    assert best.system == "New Clinic", "Most recent source should be selected"
    assert confidence > 0.5


# ──────────────────────────────────────────────────────────────────
# Test 2: High reliability beats low reliability (same recency)
# ──────────────────────────────────────────────────────────────────
def test_high_reliability_beats_low():
    sources = [
        MedicationSource(system="HighRel", medication="Metoprolol 50mg", last_updated="2025-01-10", source_reliability="high"),
        MedicationSource(system="LowRel", medication="Metoprolol 100mg", last_updated="2025-01-10", source_reliability="low"),
    ]
    context = PatientContext()
    high_score = score_source(sources[0], context)
    low_score = score_source(sources[1], context)
    assert high_score > low_score, "High reliability source should score higher"


# ──────────────────────────────────────────────────────────────────
# Test 3: Low eGFR penalises Metformin 1000mg twice daily
# ──────────────────────────────────────────────────────────────────
def test_low_egfr_penalises_high_dose_metformin():
    high_dose = MedicationSource(
        system="Hospital", medication="Metformin 1000mg twice daily",
        last_updated="2025-01-20", source_reliability="high"
    )
    low_dose = MedicationSource(
        system="Primary Care", medication="Metformin 500mg twice daily",
        last_updated="2025-01-20", source_reliability="high"
    )
    context = PatientContext(conditions=["Type 2 Diabetes"], recent_labs={"eGFR": 40})
    high_dose_score = score_source(high_dose, context)
    low_dose_score = score_source(low_dose, context)
    assert low_dose_score > high_dose_score, "Low dose Metformin should score higher when eGFR is low"


# ──────────────────────────────────────────────────────────────────
# Test 4: Source with no date gets zero recency score
# ──────────────────────────────────────────────────────────────────
def test_no_date_gets_zero_recency():
    source = MedicationSource(system="Unknown", medication="Aspirin 81mg", source_reliability="medium")
    score = _recency_score(source)
    assert score == 0.0, "Source with no date should receive zero recency score"


# ──────────────────────────────────────────────────────────────────
# Test 5: Agreement between sources boosts confidence
# ──────────────────────────────────────────────────────────────────
def test_source_agreement_boosts_confidence():
    sources_agree = [
        MedicationSource(system="A", medication="Aspirin 81mg daily", last_updated="2025-01-01", source_reliability="high"),
        MedicationSource(system="B", medication="Aspirin 81mg daily", last_updated="2025-01-02", source_reliability="high"),
        MedicationSource(system="C", medication="Aspirin 81mg daily", last_updated="2025-01-03", source_reliability="high"),
    ]
    sources_conflict = [
        MedicationSource(system="A", medication="Aspirin 81mg daily", last_updated="2025-01-01", source_reliability="high"),
        MedicationSource(system="B", medication="Ibuprofen 400mg", last_updated="2024-06-01", source_reliability="low"),
    ]
    context = PatientContext()
    _, conf_agree, _ = reconcile_medications(sources_agree, context)
    _, conf_conflict, _ = reconcile_medications(sources_conflict, context)
    assert conf_agree >= conf_conflict, "Agreeing sources should yield equal or higher confidence"
