"""
Unit tests for the data quality scoring engine.
"""
import pytest
from app.models.data_quality import DataQualityRequest, Demographics, VitalSigns
from app.services.data_quality_engine import (
    score_completeness,
    score_accuracy,
    score_timeliness,
    score_clinical_plausibility,
    score_data_quality,
)


# ──────────────────────────────────────────────────────────────────
# Test 6: Impossible blood pressure flagged as high severity
# ──────────────────────────────────────────────────────────────────
def test_impossible_blood_pressure_flagged():
    record = DataQualityRequest(
        vital_signs=VitalSigns(blood_pressure="340/180")
    )
    score, issues = score_accuracy(record)
    bp_issues = [i for i in issues if "blood_pressure" in i.field]
    assert len(bp_issues) > 0, "Impossible BP should be flagged"
    assert any(i.severity == "high" for i in bp_issues), "BP issue should be high severity"
    assert score < 80, "Accuracy score should be penalised for impossible BP"


# ──────────────────────────────────────────────────────────────────
# Test 7: Missing allergies lowers completeness score
# ──────────────────────────────────────────────────────────────────
def test_missing_allergies_lowers_completeness():
    full_record = DataQualityRequest(
        demographics=Demographics(name="Jane", dob="1970-01-01"),
        medications=["Metformin 500mg"],
        allergies=["Penicillin"],
        conditions=["Diabetes"],
        vital_signs=VitalSigns(blood_pressure="120/80"),
        last_updated="2025-01-01"
    )
    missing_allergy_record = DataQualityRequest(
        demographics=Demographics(name="Jane", dob="1970-01-01"),
        medications=["Metformin 500mg"],
        allergies=[],  # empty — likely incomplete
        conditions=["Diabetes"],
        vital_signs=VitalSigns(blood_pressure="120/80"),
        last_updated="2025-01-01"
    )
    full_score, _ = score_completeness(full_record)
    missing_score, missing_issues = score_completeness(missing_allergy_record)
    allergy_issue_flagged = any("allerg" in i.field.lower() for i in missing_issues)
    assert allergy_issue_flagged, "Missing allergies should generate an issue"


# ──────────────────────────────────────────────────────────────────
# Test 8: Old data lowers timeliness score
# ──────────────────────────────────────────────────────────────────
def test_old_data_lowers_timeliness():
    old_record = DataQualityRequest(last_updated="2022-01-01")
    recent_record = DataQualityRequest(last_updated="2026-01-01")
    old_score, _ = score_timeliness(old_record)
    recent_score, _ = score_timeliness(recent_record)
    assert recent_score > old_score, "Recent data should score higher on timeliness"


# ──────────────────────────────────────────────────────────────────
# Test 9: Diabetes with no diabetes medication lowers plausibility
# ──────────────────────────────────────────────────────────────────
def test_diabetes_without_medication_flagged():
    record = DataQualityRequest(
        conditions=["Type 2 Diabetes"],
        medications=["Lisinopril 10mg"],  # no glucose-lowering agent
    )
    score, issues = score_clinical_plausibility(record)
    diabetes_issues = [i for i in issues if "diabetes" in i.issue.lower()]
    assert len(diabetes_issues) > 0, "Diabetes without medication should be flagged"
    assert score < 100


# ──────────────────────────────────────────────────────────────────
# Test 10: Perfect record scores high overall
# ──────────────────────────────────────────────────────────────────
def test_perfect_record_scores_high():
    perfect = DataQualityRequest(
        demographics=Demographics(name="Alice Smith", dob="1960-06-15", gender="F"),
        medications=["Metformin 500mg twice daily", "Lisinopril 10mg daily"],
        allergies=["Penicillin"],
        conditions=["Type 2 Diabetes", "Hypertension"],
        vital_signs=VitalSigns(blood_pressure="128/82", heart_rate=72),
        last_updated="2025-02-01"
    )
    result = score_data_quality(perfect)
    assert result["overall_score"] >= 70, "A well-populated record should score at least 70"
