import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List


_DATE_RE = re.compile(r"^\d{4}[-/]\d{2}[-/]\d{2}$|^\d{2}[-/]\d{2}[-/]\d{4}$")
_BP_RE = re.compile(r"^\d{2,3}\s*/\s*\d{2,3}$")


def _clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    cleaned = v.strip()
    return cleaned if cleaned else None


class VitalSigns(BaseModel):
    blood_pressure: Optional[str] = Field(default=None, max_length=20)
    heart_rate: Optional[int] = Field(default=None, ge=0, le=350)
    temperature: Optional[float] = Field(default=None, ge=25.0, le=50.0)
    respiratory_rate: Optional[int] = Field(default=None, ge=0, le=100)
    oxygen_saturation: Optional[float] = Field(default=None, ge=0.0, le=100.0)

    @field_validator("blood_pressure", mode="before")
    @classmethod
    def sanitize_bp(cls, v):
        v = _clean(v)
        if v is not None and not _BP_RE.match(v):
            raise ValueError("Blood pressure must be in the format systolic/diastolic, e.g. 120/80")
        return v


class Demographics(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    dob: Optional[str] = Field(default=None, max_length=20)
    gender: Optional[str] = Field(default=None, max_length=50)

    @field_validator("name", "gender", mode="before")
    @classmethod
    def strip_str(cls, v):
        return _clean(v)

    @field_validator("dob", mode="before")
    @classmethod
    def strip_and_validate_dob(cls, v):
        v = _clean(v)
        if v is not None and not _DATE_RE.match(v):
            raise ValueError("Date of birth must be YYYY-MM-DD, YYYY/MM/DD, or MM/DD/YYYY")
        return v


class DataQualityRequest(BaseModel):
    demographics: Optional[Demographics] = None
    medications: Optional[List[str]] = Field(default=None, max_length=200)
    allergies: Optional[List[str]] = Field(default=None, max_length=200)
    conditions: Optional[List[str]] = Field(default=None, max_length=200)
    vital_signs: Optional[VitalSigns] = None
    last_updated: Optional[str] = Field(default=None, max_length=20)

    @field_validator("medications", "allergies", "conditions", mode="before")
    @classmethod
    def sanitize_string_list(cls, v):
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("Must be a list")
        if len(v) > 200:
            raise ValueError("List must not exceed 200 items")
        cleaned = [item.strip() for item in v if isinstance(item, str) and item.strip()]
        for item in cleaned:
            if len(item) > 300:
                raise ValueError("Each entry must be 300 characters or fewer")
        return cleaned if cleaned else None

    @field_validator("last_updated", mode="before")
    @classmethod
    def strip_and_validate_date(cls, v):
        v = _clean(v)
        if v is not None and not _DATE_RE.match(v):
            raise ValueError("last_updated must be YYYY-MM-DD, YYYY/MM/DD, or MM/DD/YYYY")
        return v


class QualityIssue(BaseModel):
    field: str
    issue: str
    severity: str  # "high", "medium", "low"


class QualityBreakdown(BaseModel):
    completeness: int
    accuracy: int
    timeliness: int
    clinical_plausibility: int


class DataQualityResponse(BaseModel):
    overall_score: int
    breakdown: QualityBreakdown
    issues_detected: List[QualityIssue]
    ai_insights: Optional[str] = None
