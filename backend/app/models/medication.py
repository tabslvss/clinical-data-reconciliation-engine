import re
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any


_DATE_RE = re.compile(r"^\d{4}[-/]\d{2}[-/]\d{2}$|^\d{2}[-/]\d{2}[-/]\d{4}$")


def _clean(v: Optional[str]) -> Optional[str]:
    """Strip whitespace; return None if the result is empty."""
    if v is None:
        return None
    cleaned = v.strip()
    return cleaned if cleaned else None


class MedicationSource(BaseModel):
    system: str = Field(min_length=1, max_length=100)
    medication: str = Field(min_length=1, max_length=300)
    last_updated: Optional[str] = Field(default=None, max_length=20)
    last_filled: Optional[str] = Field(default=None, max_length=20)
    source_reliability: str = Field(default="medium", pattern="^(high|medium|low)$")
    notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("system", "medication", mode="before")
    @classmethod
    def strip_required_str(cls, v):
        if isinstance(v, str):
            v = v.strip()
        if not v:
            raise ValueError("Field must not be blank")
        return v

    @field_validator("last_updated", "last_filled", "notes", mode="before")
    @classmethod
    def strip_optional_str(cls, v):
        return _clean(v)

    @field_validator("last_updated", "last_filled", mode="after")
    @classmethod
    def validate_date_format(cls, v):
        if v is not None and not _DATE_RE.match(v):
            raise ValueError("Date must be YYYY-MM-DD, YYYY/MM/DD, or MM/DD/YYYY")
        return v


class PatientContext(BaseModel):
    age: Optional[int] = Field(default=None, ge=0, le=130)
    conditions: Optional[List[str]] = Field(default_factory=list)
    recent_labs: Optional[Dict[str, Any]] = Field(default_factory=dict)
    allergies: Optional[List[str]] = Field(default_factory=list)

    @field_validator("conditions", "allergies", mode="before")
    @classmethod
    def sanitize_string_list(cls, v):
        if v is None:
            return []
        if not isinstance(v, list):
            raise ValueError("Must be a list")
        if len(v) > 100:
            raise ValueError("List must not exceed 100 items")
        cleaned = [item.strip() for item in v if isinstance(item, str) and item.strip()]
        for item in cleaned:
            if len(item) > 200:
                raise ValueError("Each entry must be 200 characters or fewer")
        return cleaned

    @field_validator("recent_labs", mode="before")
    @classmethod
    def sanitize_labs(cls, v):
        if v is None:
            return {}
        if not isinstance(v, dict):
            raise ValueError("recent_labs must be an object")
        if len(v) > 50:
            raise ValueError("recent_labs must not exceed 50 entries")
        return v


class MedicationReconcileRequest(BaseModel):
    patient_context: PatientContext
    sources: List[MedicationSource] = Field(min_length=1, max_length=20)


class MedicationReconcileResponse(BaseModel):
    reconciled_medication: str
    confidence_score: float
    reasoning: str
    recommended_actions: List[str]
    clinical_safety_check: str
    source_used: str
    conflict_summary: Optional[str] = None
