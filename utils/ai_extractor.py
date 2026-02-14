import json
from typing import Dict, Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel, Field


class RampPhase(BaseModel):
    start_month: int | None = None
    end_month: int | None = None
    price_per_month: str | None = None
    discount_percent: float | None = None
    notes: str | None = None


class ExtractedContract(BaseModel):
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    vendor_name: str | None = None

    plan_id: str | None = None
    plan_name: str | None = None
    item_price_id: str | None = None
    currency: str | None = None

    start_date: str | None = None
    term_months: int | None = None
    payment_terms: str | None = None

    base_price_per_month: str | None = None
    tax_percent: float | None = None
    po_number: str | None = None

    ramp: list[RampPhase] = Field(default_factory=list)
    annual_escalation_percent: float | None = None

    source_confidence_notes: str | None = None
    raw_notes: str | None = None


SYSTEM_PROMPT = """You are an expert contract data extraction assistant specializing in subscription billing.

Your task:
1. Extract structured subscription data from contract text
2. Return ONLY valid JSON (no markdown, no code fences)
3. Use null for missing values

Key extraction rules:
- Extract "Plan ID" or "item_price_id" exactly as shown
- Dates: convert to YYYY-MM-DD format
- Prices: keep as strings (include currency symbols if present)
- Ramp schedules: capture as array of phases
- Tax: extract percentage as float
- If ambiguous, note in source_confidence_notes
"""

USER_PROMPT_TEMPLATE = """Extract subscription details from this contract:

{contract_text}

Return JSON matching this schema:
{schema}

Remember: ONLY return the JSON object, no extra text or formatting."""


def extract_contract_data(
    contract_text: str,
    google_api_key: str,
    model_name: str = "gemini-1.5-pro"
) -> Dict[str, Any]:
    """Extract structured contract data using Gemini AI."""

    if not google_api_key:
        raise ValueError("GOOGLE_API_KEY is required")

    # Generate schema
    schema = ExtractedContract.model_json_schema()
    schema_json = json.dumps(schema, indent=2)

    # Initialize LLM
    llm = ChatGoogleGenerativeAI(
        model=model_name,
        temperature=0.1,
        google_api_key=google_api_key,
    )

    # Build prompt
    user_prompt = USER_PROMPT_TEMPLATE.format(
        contract_text=contract_text[:25000],  # Limit context size
        schema=schema_json
    )

    # Get response
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt)
    ])

    content = (response.content or "").strip()

    # Extract JSON from response (handle cases where model adds extra text)
    start = content.find("{")
    end = content.rfind("}") + 1

    if start != -1 and end > start:
        content = content[start:end]

    # Parse and validate
    data = json.loads(content)
    validated = ExtractedContract.model_validate(data)

    return validated.model_dump()
