"""
AI reasoning layer — uses OpenAI to generate clinical reasoning.
Logic ALWAYS runs first; this layer only adds human-readable explanations.
Includes in-memory caching and graceful fallback on API failure.
"""
import os
import json
import logging
from typing import Optional
from openai import OpenAI, RateLimitError, APIError
from app.utils.cache import get_cached, set_cached, make_cache_key

logger = logging.getLogger(__name__)

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


RECONCILE_SYSTEM_PROMPT = """
You are a clinical data reconciliation assistant helping healthcare providers resolve conflicting medication records.
You receive structured data: a selected medication (chosen by a rule engine), the conflicting alternatives, and patient context.
Your job is to generate concise, clinically sound reasoning for why the selected medication is most appropriate.
Always return valid JSON only — no markdown, no explanation outside the JSON object.
""".strip()

QUALITY_SYSTEM_PROMPT = """
You are a clinical data quality analyst. You receive a summary of issues found in a patient record.
Provide a brief, plain-English insight that a clinician would find helpful.
Return only a single JSON object with key "ai_insights" containing your text.
""".strip()


def get_reconciliation_reasoning(
    reconciled_medication: str,
    all_sources: list[dict],
    patient_context: dict,
    confidence_score: float,
) -> dict:
    """
    Returns dict with keys: reasoning, recommended_actions, clinical_safety_check
    Falls back to a sensible default if the AI call fails.
    """
    cache_payload = {
        "reconciled": reconciled_medication,
        "sources": all_sources,
        "context": patient_context,
    }
    cache_key = make_cache_key(cache_payload)
    cached = get_cached(cache_key)
    if cached:
        logger.info("Returning cached AI reconciliation response")
        return cached

    user_message = f"""
Selected reconciled medication: {reconciled_medication}

Conflicting sources:
{json.dumps(all_sources, indent=2)}

Patient context:
{json.dumps(patient_context, indent=2)}

Confidence score assigned by rule engine: {confidence_score}

Return a JSON object with exactly these keys:
{{
  "reasoning": "2-3 sentence clinical explanation for why this medication/dose is most appropriate",
  "recommended_actions": ["action 1", "action 2"],
  "clinical_safety_check": "PASSED or WARNING"
}}
""".strip()

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": RECONCILE_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            timeout=15,
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)
        set_cached(cache_key, result)
        return result

    except RateLimitError:
        logger.warning("OpenAI rate limit hit — using fallback reasoning")
    except APIError as e:
        logger.warning(f"OpenAI API error: {e} — using fallback reasoning")
    except Exception as e:
        logger.warning(f"Unexpected AI error: {e} — using fallback reasoning")

    fallback = {
        "reasoning": (
            "Rule-based reconciliation applied. "
            "The most recent high-reliability source was selected. "
            "AI explanation unavailable — verify manually."
        ),
        "recommended_actions": ["Review conflicting sources manually", "Confirm with prescribing clinician"],
        "clinical_safety_check": "WARNING",
    }
    return fallback


def get_quality_insights(issues_summary: str, patient_context: dict) -> str:
    """
    Returns a plain-English AI insight string.
    Falls back to empty string on failure.
    """
    cache_key = make_cache_key({"issues": issues_summary, "ctx": patient_context})
    cached = get_cached(cache_key)
    if cached:
        return cached

    user_message = f"""
Issues detected in patient record:
{issues_summary}

Patient summary: {json.dumps(patient_context)}

Return JSON: {{ "ai_insights": "your brief clinical insight here" }}
""".strip()

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": QUALITY_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            timeout=15,
        )
        raw = response.choices[0].message.content
        insight = json.loads(raw).get("ai_insights", "")
        set_cached(cache_key, insight)
        return insight

    except Exception as e:
        logger.warning(f"AI quality insights unavailable: {e}")
        return ""
