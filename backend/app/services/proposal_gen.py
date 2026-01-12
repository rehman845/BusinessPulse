import json
from pathlib import Path
from typing import List

from openai import OpenAI

from ..settings import settings
from .. import models
from .retrieval import retrieve_customer_context


client = OpenAI(api_key=settings.OPENAI_API_KEY)


def _load_prompt() -> str:
    return Path("app/prompts/proposal_persona.txt").read_text(encoding="utf-8")


def _build_context_block(customer_id: str) -> str:
    context_items = retrieve_customer_context(customer_id=customer_id, top_k=12)
    context_lines: List[str] = []
    for item in context_items:
        doc_type = item.get("doc_type", "unknown")
        chunk_index = item.get("chunk_index", "?")
        text = item.get("text", "")
        context_lines.append(f"[{doc_type} | chunk {chunk_index}] {text}")
    context_block = "\n".join(context_lines)
    return context_block[:8000]  # keep bounded


def generate_proposal(customer: models.Customer) -> dict:
    system_prompt = _load_prompt()
    context_block = _build_context_block(customer_id=customer.id)

    user_prompt = f"""
Customer ID: {customer.id}
Customer Name: {customer.name}

Combined Context from all documents (requirements, emails, meeting minutes, questionnaire responses, etc.):
{context_block}
"""

    resp = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    text = resp.choices[0].message.content.strip()

    try:
        return json.loads(text)
    except Exception:
        # fallback minimal proposal
        return {
            "customer_id": customer.id,
            "summary": "Proposal summary unavailable (LLM returned invalid JSON).",
            "scope": ["Define scope based on provided materials."],
            "approach": ["TBD"],
            "timeline": [{"phase": "TBD", "duration": "TBD", "activities": []}],
            "pricing_assumptions": ["Pricing requires validation."],
            "risks": [{"risk": "No valid proposal generated", "mitigation": "Retry with more context"}],
            "dependencies": [],
            "next_steps": ["Provide clarified inputs and retry generation."],
        }

