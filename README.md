# ClinicalRx — Clinical Data Reconciliation Engine

A full-stack application that resolves conflicting medication records across EHR systems using rule-based clinical logic combined with AI-generated reasoning.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [LLM Choice & Prompt Engineering](#llm-choice--prompt-engineering)
- [Key Design Decisions](#key-design-decisions)
- [Trade-offs](#trade-offs)
- [What I'd Improve With More Time](#what-id-improve-with-more-time)
- [Estimated Time Spent](#estimated-time-spent)

---

## Overview

Healthcare providers often hold conflicting information about the same patient across different systems. This engine takes multiple conflicting medication records as input and returns:

- The **most likely correct medication/dose**
- A **calibrated confidence score**
- **Clinical reasoning** (AI-generated, grounded in rules)
- **Recommended actions** for clinicians
- A **clinical safety check** status

It also validates patient record quality across four dimensions: completeness, accuracy, timeliness, and clinical plausibility.

---

## Architecture

```
Frontend (React + Vite)
    │
    │  POST /api/reconcile/medication
    │  POST /api/validate/data-quality
    │
Backend (FastAPI)
    ├── Rule Engine        ← deterministic logic runs FIRST
    │     ├── Recency scoring (newer sources weighted higher)
    │     ├── Reliability weighting (high/medium/low)
    │     ├── Clinical adjustments (e.g., eGFR ↓ → lower Metformin dose)
    │     └── Confidence calibration
    │
    ├── AI Layer (OpenAI GPT-4o-mini)
    │     ├── Generates human-readable reasoning
    │     ├── Produces recommended actions
    │     └── Returns clinical safety status
    │
    └── In-memory cache (SHA-256 keyed)
          └── Avoids duplicate OpenAI calls for identical inputs
```

**Key architectural decision:** The rule engine decides the answer; the AI only explains it. This prevents unsafe LLM-only decisions while still providing clinician-friendly narratives.

---

## Tech Stack

| Layer     | Technology             | Why                                                         |
|-----------|------------------------|-------------------------------------------------------------|
| Backend   | FastAPI (Python)       | Automatic docs, Pydantic validation, fast async support     |
| Frontend  | React 19 + Vite        | Fast HMR, clean component model, recruiter-familiar         |
| AI        | OpenAI GPT-4o-mini     | Best balance of cost, speed, and clinical reasoning quality |
| Auth      | API key header         | Simple, stateless, meets the brief requirement              |
| Storage   | In-memory (dict)       | No DB needed; cache lives in process memory                 |
| Tests     | pytest                 | Fast, readable, standard Python testing                     |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An OpenAI API key ([platform.openai.com](https://platform.openai.com))

---

### Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
copy .env.example .env      # Windows
cp .env.example .env        # macOS/Linux

# Edit .env and add your keys:
# OPENAI_API_KEY=sk-...
# API_KEY=dev-secret-key

# Start the API server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

---

### Frontend Setup

```bash
cd frontend

# Copy environment file
copy .env.example .env      # Windows
cp .env.example .env        # macOS/Linux

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`

> **Note:** If you don't have an OpenAI key, the app still works — the backend falls back to rule-based reasoning with a `WARNING` safety status.

---

## API Reference

All endpoints require the `x-api-key` header.

### `POST /api/reconcile/medication`

Reconciles conflicting medication records across EHR systems.

**Request:**
```json
{
  "patient_context": {
    "age": 67,
    "conditions": ["Type 2 Diabetes", "Hypertension"],
    "recent_labs": { "eGFR": 45 }
  },
  "sources": [
    {
      "system": "Hospital EHR",
      "medication": "Metformin 1000mg twice daily",
      "last_updated": "2024-10-15",
      "source_reliability": "high"
    },
    {
      "system": "Primary Care",
      "medication": "Metformin 500mg twice daily",
      "last_updated": "2025-01-20",
      "source_reliability": "high"
    }
  ]
}
```

**Response:**
```json
{
  "reconciled_medication": "Metformin 500mg twice daily",
  "confidence_score": 0.88,
  "reasoning": "Primary care record is most recent...",
  "recommended_actions": ["Update Hospital EHR to 500mg twice daily"],
  "clinical_safety_check": "PASSED",
  "source_used": "Primary Care",
  "conflict_summary": "- Hospital EHR: Metformin 1000mg..."
}
```

---

### `POST /api/validate/data-quality`

Scores a patient record across four quality dimensions.

**Request:**
```json
{
  "demographics": { "name": "John Doe", "dob": "1955-03-15", "gender": "M" },
  "medications": ["Metformin 500mg", "Lisinopril 10mg"],
  "allergies": [],
  "conditions": ["Type 2 Diabetes"],
  "vital_signs": { "blood_pressure": "340/180", "heart_rate": 72 },
  "last_updated": "2024-06-15"
}
```

**Response:**
```json
{
  "overall_score": 62,
  "breakdown": {
    "completeness": 60,
    "accuracy": 50,
    "timeliness": 70,
    "clinical_plausibility": 40
  },
  "issues_detected": [
    {
      "field": "vital_signs.blood_pressure",
      "issue": "Blood pressure 340/180 is physiologically implausible",
      "severity": "high"
    }
  ],
  "ai_insights": "The critically elevated blood pressure value..."
}
```

---

## Running Tests

```bash
cd backend

# Activate your virtual environment first
venv\Scripts\activate   # Windows
source venv/bin/activate  # macOS/Linux

# Run all tests with verbose output
pytest tests/ -v
```

**Test coverage (10 tests across 2 files):**

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | `test_most_recent_source_wins` | Recency scoring selects newer records |
| 2 | `test_high_reliability_beats_low` | Reliability weighting works correctly |
| 3 | `test_low_egfr_penalises_high_dose_metformin` | Clinical adjustment for kidney function |
| 4 | `test_no_date_gets_zero_recency` | Edge case: missing date handling |
| 5 | `test_source_agreement_boosts_confidence` | Agreement bonus logic |
| 6 | `test_impossible_blood_pressure_flagged` | Physiologically impossible vitals caught |
| 7 | `test_missing_allergies_lowers_completeness` | Incomplete allergy field detected |
| 8 | `test_old_data_lowers_timeliness` | Timeliness scoring |
| 9 | `test_diabetes_without_medication_flagged` | Drug-disease mismatch detection |
| 10 | `test_perfect_record_scores_high` | High-quality record gets good score |

---

## LLM Choice & Prompt Engineering

**Model:** OpenAI `gpt-4o-mini`

**Why GPT-4o-mini:**
- Low cost (~$0.15/1M input tokens) — ideal for a take-home with real API costs
- Fast response times (<2s typical)
- Strong instruction-following for structured JSON output
- Supports `response_format: json_object` to guarantee valid JSON back

**Prompt Engineering Approach:**

1. **System prompt sets role and constraints** — the model is told it is a reconciliation assistant that must return only JSON. This prevents markdown wrapping or free-form text.

2. **Rule engine results are passed as context** — the model receives the already-selected medication alongside all alternatives. It is not asked to decide; it is asked to explain. This keeps AI in an advisory role.

3. **Structured output keys are explicit** — the user message specifies exact JSON keys (`reasoning`, `recommended_actions`, `clinical_safety_check`) with descriptions. This reduces hallucination.

4. **Temperature = 0.2** — low enough for consistent, factual output; not zero to allow natural language variation.

5. **Fallback on failure** — if the API is unavailable or rate-limited, the backend returns pre-written fallback text with `clinical_safety_check: "WARNING"` so the UI still functions.

6. **Response caching** — requests are SHA-256 hashed and cached in memory. Repeated identical inputs (e.g., during testing or UI refreshes) never hit the API twice.

---

## Key Design Decisions

### 1. Rule Engine First, AI Second
The biggest architectural decision. Rather than sending raw conflicting records to an LLM and hoping it picks the right answer, the backend runs deterministic rules first:
- Recency scoring (40% weight)
- Reliability weighting (40% weight)
- Clinical safety adjustments (20% weight) — e.g., eGFR < 45 penalises high-dose Metformin

The LLM only generates narrative reasoning for the answer the rules already selected. This means:
- Results are reproducible
- Clinical safety is never AI-dependent
- The system works even without an API key

### 2. Confidence Score is Deterministic
Confidence is calculated mathematically from the scoring components — not asked of the AI. This makes it reliable and auditable. An AI-reported "88% confidence" would be meaningless; a score derived from source recency + reliability + agreement is meaningful.

### 3. In-Memory Cache
All AI responses are cached by SHA-256 hash of the request payload. For a take-home, this avoids burning API credits during development. In production, this would be Redis with a TTL.

### 4. Pydantic Validation Throughout
Every request and response is fully typed with Pydantic v2. Invalid inputs get descriptive 422 errors automatically — no manual validation code needed.

### 5. CORS configured for local dev
The backend allows requests from `localhost:5173` (Vite dev server) and `localhost:3000` by default. Easily changed for production via environment variable.

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| Rule engine over pure LLM | Predictable, auditable safety | More upfront logic to write |
| In-memory cache | Zero infrastructure, free | Lost on server restart |
| GPT-4o-mini over GPT-4o | 10x cheaper | Slightly less sophisticated reasoning |
| No database | Simpler setup | No persistence between restarts |
| API key auth over JWT | Simple to implement | Not scalable for multi-user production |

---

## What I'd Improve With More Time

1. **SNOMED/RxNorm normalization** — "Metformin 500mg" and "metformin hcl 500 mg" are the same drug; a terminology service would catch this before scoring
2. **Duplicate record detection** — cluster sources that reference the same underlying prescription using fuzzy matching on medication name + dose
3. **Persistent storage** — PostgreSQL with audit trail of reconciliation decisions and clinician approvals/rejections
4. **Redis caching** — replace in-memory dict with Redis for distributed caching and configurable TTL
5. **Webhook support** — push reconciliation results to external systems when a clinician approves
6. **Docker Compose** — single `docker compose up` to start both services
7. **Deployment** — Railway for backend, Vercel for frontend
8. **Clinician audit trail** — log every approve/reject decision with timestamp and user ID
9. **Multi-medication reconciliation** — handle entire medication lists, not just single drugs
10. **Confidence calibration tuning** — validate score accuracy against known ground-truth datasets

---

## Estimated Time Spent

| Phase | Time |
|-------|------|
| Architecture planning | ~1 hour |
| Backend API + models + auth | ~2 hours |
| Rule engine + data quality engine | ~2.5 hours |
| AI service + prompt engineering + caching | ~1.5 hours |
| Unit tests | ~1 hour |
| Frontend (React + UI components) | ~2.5 hours |
| README + documentation | ~1 hour |
| **Total** | **~11.5 hours** |
