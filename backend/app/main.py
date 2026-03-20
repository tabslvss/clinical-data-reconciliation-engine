import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes.reconcile import router as reconcile_router
from app.routes.validate import router as validate_router

load_dotenv()

app = FastAPI(
    title="Clinical Data Reconciliation Engine",
    description=(
        "A mini EHR reconciliation platform that combines rule-based clinical logic "
        "with AI-generated reasoning to resolve conflicting medication records and "
        "score patient data quality."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reconcile_router, prefix="/api/reconcile", tags=["Reconciliation"])
app.include_router(validate_router, prefix="/api/validate", tags=["Validation"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "Clinical Data Reconciliation Engine"}
