"""
Rule-based data quality scoring engine.
Scores are deterministic; AI is called afterwards for deeper insights.
"""
from datetime import datetime
from typing import Optional
from app.models.data_quality import DataQualityRequest, QualityIssue


def _parse_bp(bp_str: Optional[str]) -> tuple[Optional[int], Optional[int]]:
    if not bp_str:
        return None, None
    try:
        parts = bp_str.replace(" ", "").split("/")
        if len(parts) == 2:
            return int(parts[0]), int(parts[1])
    except (ValueError, AttributeError):
        pass
    return None, None


def _days_since(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            d = datetime.strptime(date_str, fmt)
            return (datetime.now() - d).days
        except ValueError:
            continue
    return None


# ──────────────────────────────────────────────
# Dimension scorers
# ──────────────────────────────────────────────

def score_completeness(record: DataQualityRequest) -> tuple[int, list[QualityIssue]]:
    issues: list[QualityIssue] = []
    total_fields = 6
    present = 0

    if record.demographics and (record.demographics.name or record.demographics.dob):
        present += 1
    else:
        issues.append(QualityIssue(field="demographics", issue="Demographics missing or incomplete", severity="medium"))

    if record.medications:
        present += 1
    else:
        issues.append(QualityIssue(field="medications", issue="No medications documented", severity="medium"))

    if record.allergies is not None:
        if len(record.allergies) == 0:
            issues.append(QualityIssue(field="allergies", issue="No allergies documented — likely incomplete rather than truly NKDA", severity="medium"))
        present += 1
    else:
        issues.append(QualityIssue(field="allergies", issue="Allergy field entirely absent", severity="high"))

    if record.conditions:
        present += 1
    else:
        issues.append(QualityIssue(field="conditions", issue="No conditions/diagnoses documented", severity="medium"))

    if record.vital_signs:
        present += 1
    else:
        issues.append(QualityIssue(field="vital_signs", issue="Vital signs missing", severity="low"))

    if record.last_updated:
        present += 1
    else:
        issues.append(QualityIssue(field="last_updated", issue="No last_updated timestamp", severity="low"))

    return round((present / total_fields) * 100), issues


def score_accuracy(record: DataQualityRequest) -> tuple[int, list[QualityIssue]]:
    issues: list[QualityIssue] = []
    deductions = 0

    if record.vital_signs:
        systolic, diastolic = _parse_bp(record.vital_signs.blood_pressure)
        if systolic is not None:
            if systolic > 300 or systolic < 40:
                issues.append(QualityIssue(
                    field="vital_signs.blood_pressure",
                    issue=f"Blood pressure {record.vital_signs.blood_pressure} is physiologically implausible",
                    severity="high"
                ))
                deductions += 30
            elif systolic > 200:
                issues.append(QualityIssue(
                    field="vital_signs.blood_pressure",
                    issue=f"Blood pressure {record.vital_signs.blood_pressure} is critically elevated — verify accuracy",
                    severity="high"
                ))
                deductions += 15

        if diastolic is not None and (diastolic > 150 or diastolic < 20):
            issues.append(QualityIssue(
                field="vital_signs.blood_pressure",
                issue=f"Diastolic pressure {diastolic} is outside physiological range",
                severity="high"
            ))
            deductions += 20

        hr = record.vital_signs.heart_rate
        if hr is not None:
            if hr > 250 or hr < 20:
                issues.append(QualityIssue(
                    field="vital_signs.heart_rate",
                    issue=f"Heart rate {hr} bpm is physiologically implausible",
                    severity="high"
                ))
                deductions += 25
            elif hr > 180 or hr < 40:
                issues.append(QualityIssue(
                    field="vital_signs.heart_rate",
                    issue=f"Heart rate {hr} bpm is outside normal limits — verify accuracy",
                    severity="medium"
                ))
                deductions += 10

        spo2 = record.vital_signs.oxygen_saturation
        if spo2 is not None and (spo2 > 100 or spo2 < 50):
            issues.append(QualityIssue(
                field="vital_signs.oxygen_saturation",
                issue=f"SpO2 {spo2}% is outside physiological range",
                severity="high"
            ))
            deductions += 20

        temp = record.vital_signs.temperature
        if temp is not None and (temp > 45 or temp < 32):
            issues.append(QualityIssue(
                field="vital_signs.temperature",
                issue=f"Temperature {temp}°C is outside survivable range",
                severity="high"
            ))
            deductions += 20

    if record.demographics and record.demographics.dob:
        try:
            dob = datetime.strptime(record.demographics.dob, "%Y-%m-%d")
            age = (datetime.now() - dob).days / 365.25
            if age < 0 or age > 130:
                issues.append(QualityIssue(
                    field="demographics.dob",
                    issue=f"Date of birth implies age {int(age)} — implausible",
                    severity="high"
                ))
                deductions += 20
        except ValueError:
            issues.append(QualityIssue(
                field="demographics.dob",
                issue="Date of birth format unrecognised",
                severity="medium"
            ))
            deductions += 10

    return max(100 - deductions, 0), issues


def score_timeliness(record: DataQualityRequest) -> tuple[int, list[QualityIssue]]:
    issues: list[QualityIssue] = []
    days = _days_since(record.last_updated)
    if days is None:
        return 50, []

    if days <= 30:
        return 100, []
    elif days <= 90:
        return 85, []
    elif days <= 180:
        issues.append(QualityIssue(
            field="last_updated",
            issue=f"Data is {days // 30} months old — consider updating",
            severity="low"
        ))
        return 70, issues
    elif days <= 365:
        issues.append(QualityIssue(
            field="last_updated",
            issue=f"Data is 7+ months old",
            severity="medium"
        ))
        return 50, issues
    else:
        issues.append(QualityIssue(
            field="last_updated",
            issue=f"Data is over a year old — reliability questionable",
            severity="high"
        ))
        return 20, issues


def score_clinical_plausibility(record: DataQualityRequest) -> tuple[int, list[QualityIssue]]:
    """
    Cross-field clinical plausibility checks.
    E.g., diabetes patient with no diabetes medication listed.
    """
    issues: list[QualityIssue] = []
    deductions = 0
    conditions_lower = [c.lower() for c in (record.conditions or [])]
    meds_lower = " ".join(record.medications or []).lower()

    # Diabetes with no glucose-lowering agent
    if any("diabetes" in c for c in conditions_lower):
        glucose_meds = ["metformin", "insulin", "glipizide", "sitagliptin", "empagliflozin", "liraglutide"]
        if not any(m in meds_lower for m in glucose_meds):
            issues.append(QualityIssue(
                field="medications",
                issue="Diabetes diagnosed but no diabetes medication listed",
                severity="medium"
            ))
            deductions += 20

    # Hypertension with no BP medication
    if any("hypertension" in c for c in conditions_lower):
        bp_meds = ["lisinopril", "amlodipine", "metoprolol", "losartan", "hydrochlorothiazide", "atenolol"]
        if not any(m in meds_lower for m in bp_meds):
            issues.append(QualityIssue(
                field="medications",
                issue="Hypertension diagnosed but no antihypertensive listed",
                severity="medium"
            ))
            deductions += 15

    return max(100 - deductions, 0), issues


# ──────────────────────────────────────────────
# Aggregate scorer
# ──────────────────────────────────────────────

def score_data_quality(record: DataQualityRequest) -> dict:
    c_score, c_issues = score_completeness(record)
    a_score, a_issues = score_accuracy(record)
    t_score, t_issues = score_timeliness(record)
    p_score, p_issues = score_clinical_plausibility(record)

    overall = round((c_score * 0.25 + a_score * 0.30 + t_score * 0.20 + p_score * 0.25))
    all_issues = c_issues + a_issues + t_issues + p_issues

    return {
        "overall_score": overall,
        "breakdown": {
            "completeness": c_score,
            "accuracy": a_score,
            "timeliness": t_score,
            "clinical_plausibility": p_score,
        },
        "issues_detected": [i.model_dump() for i in all_issues],
    }
