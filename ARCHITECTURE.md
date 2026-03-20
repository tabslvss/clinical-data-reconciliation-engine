# Architecture Decisions

## System Design Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                   │
│  ReconcilePage          ValidatePage                        │
│  ┌──────────────┐    ┌──────────────────┐                  │
│  │ Input JSON   │    │  Input JSON      │                  │
│  │ Result Card  │    │  Quality Report  │                  │
│  │ Approve/Rej  │    │  Score Ring      │                  │
│  └──────────────┘    └──────────────────┘                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP + x-api-key header
┌─────────────────────────▼───────────────────────────────────┐
│                    FastAPI Backend                          │
│                                                             │
│  /api/reconcile/medication    /api/validate/data-quality    │
│           │                           │                     │
│  ┌────────▼────────────┐   ┌──────────▼──────────────┐     │
│  │  ReconciliationEng  │   │   DataQualityEngine      │     │
│  │  ─ Recency score    │   │   ─ Completeness         │     │
│  │  ─ Reliability wt   │   │   ─ Accuracy             │     │
│  │  ─ Clinical adjust  │   │   ─ Timeliness           │     │
│  │  ─ Confidence calc  │   │   ─ Plausibility         │     │
│  └────────┬────────────┘   └──────────┬──────────────┘     │
│           │                           │                     │
│  ┌────────▼────────────────────────────▼──────────────┐     │
│  │                 AI Service Layer                    │     │
│  │   ─ SHA-256 request cache (in-memory)              │     │
│  │   ─ OpenAI GPT-4o-mini (json_object mode)          │     │
│  │   ─ Graceful fallback on API failure               │     │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Decision Log

### ADR-001: Rule Engine Before AI

**Status:** Accepted

**Context:** The core task requires picking the "most likely correct" medication from conflicting sources. We could either:
- (A) Send all sources directly to an LLM and ask it to decide
- (B) Run deterministic rules first, then use LLM only for explanation

**Decision:** Option B.

**Consequences:**
- (+) Results are reproducible and auditable — same input always gives same clinical decision
- (+) System works without an API key (fallback reasoning is used)
- (+) Clinical safety never depends on LLM non-determinism
- (-) More code to write upfront
- (-) Rules may not cover every edge case

---

### ADR-002: Confidence Score Formula

**Status:** Accepted

**Context:** The spec asks for a confidence score. We could ask the AI to produce one, or calculate it deterministically.

**Decision:** Calculate deterministically.

```
score = (recency × 0.4) + (reliability × 0.4) + (clinical_adjustment × 0.2)
confidence = min(score + agreement_bonus, 0.95)
```

- `recency`: 1.0 = today, decays linearly to 0.0 at 365 days
- `reliability`: high=1.0, medium=0.67, low=0.33
- `clinical_adjustment`: ±0.2 based on patient context (e.g., eGFR, drug interactions)
- `agreement_bonus`: +0.05 per additional source that agrees (max 0.10)
- Hard cap at 0.95: no system should claim 100% certainty in clinical decisions

**Consequences:**
- (+) Score is meaningful and explainable
- (+) Calibrated against known clinical factors
- (-) Weights are approximate and not statistically validated

---

### ADR-003: In-Memory Caching

**Status:** Accepted (with known limitation)

**Context:** OpenAI API calls cost money. During development and testing, the same requests are made repeatedly.

**Decision:** Cache by SHA-256 hash of the serialized request payload in a Python dict.

**Consequences:**
- (+) Zero infrastructure required
- (+) Transparent to callers
- (-) Cache is lost on server restart
- (-) Not shared across multiple backend instances

**Production upgrade path:** Replace `dict` with Redis using the same key scheme + a TTL of ~24 hours.

---

### ADR-004: OpenAI GPT-4o-mini

**Status:** Accepted

**Context:** Several LLMs were candidates: GPT-4o, GPT-4o-mini, Claude 3.5 Haiku, open-source models.

**Decision:** GPT-4o-mini.

**Reasons:**
1. `response_format: json_object` guarantees parseable output without post-processing
2. ~10× cheaper than GPT-4o for similar quality on constrained JSON tasks
3. Sub-2s latency keeps the UI responsive
4. Well-documented fallback behavior

---

### ADR-005: FastAPI Over Flask/Django

**Status:** Accepted

**Context:** Python web framework choice.

**Decision:** FastAPI.

**Reasons:**
1. Pydantic v2 integration means all validation is declarative — no manual `if not x: raise`
2. Auto-generated `/docs` endpoint is useful during development and impresses reviewers
3. Async-native for future scaling
4. Type annotations throughout make the code self-documenting

---

### ADR-006: No Database

**Status:** Accepted

**Context:** The spec explicitly says "Database: Optional (can use in-memory storage)".

**Decision:** In-memory only.

**Consequences:**
- (+) No Docker required for a working local setup
- (+) Dramatically simpler setup instructions
- (-) No persistence of clinician approve/reject decisions
- (-) No audit trail

**Production upgrade path:** PostgreSQL with SQLAlchemy, storing: reconciliation_results, clinician_decisions, audit_log.

---

## Folder Structure Rationale

```
backend/
├── app/
│   ├── main.py           # App entrypoint, middleware, router registration
│   ├── models/           # Pydantic input/output schemas (data contracts)
│   ├── routes/           # HTTP handlers only — no business logic
│   ├── services/         # All business logic (engine + AI)
│   └── utils/            # Cross-cutting concerns (auth, cache)
├── tests/                # Pytest unit tests
└── conftest.py           # sys.path fix for test imports
```

Routes contain only HTTP concerns (request parsing, response construction).  
Services contain all business logic and are fully testable without HTTP.  
This separation means tests never need to spin up a web server.
