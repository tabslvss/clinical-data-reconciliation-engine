from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class MedicationSource(BaseModel):
    system: str
    medication: str
    last_updated: Optional[str] = None
    last_filled: Optional[str] = None
    source_reliability: str = Field(default="medium", pattern="^(high|medium|low)$")
    notes: Optional[str] = None


class PatientContext(BaseModel):
    age: Optional[int] = None
    conditions: Optional[List[str]] = []
    recent_labs: Optional[Dict[str, Any]] = {}
    allergies: Optional[List[str]] = []


class MedicationReconcileRequest(BaseModel):
    patient_context: PatientContext
    sources: List[MedicationSource] = Field(min_length=1)


class MedicationReconcileResponse(BaseModel):
    reconciled_medication: str
    confidence_score: float
    reasoning: str
    recommended_actions: List[str]
    clinical_safety_check: str
    source_used: str
    conflict_summary: Optional[str] = None
