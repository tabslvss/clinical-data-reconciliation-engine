from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class VitalSigns(BaseModel):
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[float] = None


class Demographics(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None


class DataQualityRequest(BaseModel):
    demographics: Optional[Demographics] = None
    medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    conditions: Optional[List[str]] = None
    vital_signs: Optional[VitalSigns] = None
    last_updated: Optional[str] = None


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
