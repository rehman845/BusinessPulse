import json
from pathlib import Path
from openai import OpenAI
from ..settings import settings
from .retrieval import retrieve_customer_context

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def _load_prompt() -> str:
    return Path("app/prompts/engineer_persona.txt").read_text(encoding="utf-8")


def generate_questionnaire(customer_id: str) -> dict:
    context_items = retrieve_customer_context(customer_id=customer_id, top_k=12)

    # Build context pack
    context_lines = []
    for item in context_items:
        doc_type = item.get("doc_type", "unknown")
        chunk_index = item.get("chunk_index", "?")
        text = item.get("text", "")
        context_lines.append(f"[{doc_type} | chunk {chunk_index}] {text}")

    context_block = "\n".join(context_lines)
    context_block = context_block[:8000]  # keep it bounded

    system_prompt = _load_prompt()

    user_prompt = f"""
Customer ID: {customer_id}

Context extracted from customer documents (meeting minutes, requirements, etc.):
{context_block}

Return STRICT JSON in this format:
{{
  "customer_id": "{customer_id}",
  "sections": [
    {{
      "title": "Section name",
      "questions": [
        {{"q": "question", "why": "why needed", "priority": "high|medium|low"}}
      ]
    }}
  ],
  "notes": "optional"
}}
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

    # Parse JSON safely
    try:
        return json.loads(text)
    except Exception:
        # fallback response so pipeline still works
        return {
            "customer_id": customer_id,
            "sections": [
                {
                    "title": "Clarifications (Fallback)",
                    "questions": [
                        {"q": "What integrations are required (email/WhatsApp/CRM/calendar)?", "why": "Defines APIs and scope", "priority": "high"},
                        {"q": "What acceptance criteria define success for this system?", "why": "Prevents scope confusion", "priority": "high"},
                    ],
                }
            ],
            "notes": "LLM output was not valid JSON. Pipeline still executed."
        }
