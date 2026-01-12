"""
Query Enhancement and Understanding for RAG
Improves query understanding, expansion, and routing
"""

import re
from typing import Dict, List, Tuple, Optional
from ..settings import settings
from .embeddings import embed_text


def extract_query_intent(query: str) -> Dict[str, any]:
    """
    Extract intent and metadata from user query.
    Returns dict with: intent_type, document_types, time_references, customer_refs, etc.
    """
    query_lower = query.lower()
    
    intent = {
        "intent_type": "general",  # general, specific_doc_type, comparison, temporal, factual
        "document_types": [],
        "time_references": [],
        "customer_refs": [],
        "keywords": [],
        "question_type": "what",  # what, who, when, where, why, how
    }
    
    # Detect document type mentions
    doc_type_patterns = {
        "proposal": ["proposal", "proposed", "proposing"],
        "questionnaire": ["questionnaire", "questions", "question"],
        "questionnaire_response": ["response", "answer", "answered", "said", "replied", "responded"],
        "requirements": ["requirement", "requirements", "needs", "needed", "needs"],
        "meeting_minutes": ["meeting", "minutes", "discussed", "discussion"],
        "email": ["email", "emailed", "sent", "message"],
    }
    
    for doc_type, patterns in doc_type_patterns.items():
        if any(pattern in query_lower for pattern in patterns):
            intent["document_types"].append(doc_type)
    
    # Detect question type
    question_words = {
        "what": ["what", "which"],
        "who": ["who", "whom"],
        "when": ["when", "what time", "what date"],
        "where": ["where"],
        "why": ["why", "reason", "because"],
        "how": ["how", "method", "way"],
    }
    
    for q_type, words in question_words.items():
        if any(word in query_lower for word in words):
            intent["question_type"] = q_type
            break
    
    # Detect time references
    time_patterns = [
        r'\b(today|yesterday|tomorrow|this week|last week|next week|this month|last month|next month)\b',
        r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}',
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',
        r'\b\d{4}-\d{2}-\d{2}\b',
    ]
    
    for pattern in time_patterns:
        matches = re.findall(pattern, query_lower)
        intent["time_references"].extend(matches)
    
    # Detect customer references (basic - will be enhanced by extract_customer_from_query)
    customer_patterns = [
        r'\bcustomer\s+([A-Z]?\d+)\b',
        r'\b([A-Z]\d+)\b',
    ]
    
    for pattern in customer_patterns:
        matches = re.findall(pattern, query_lower)
        intent["customer_refs"].extend(matches)
    
    # Extract key terms (nouns, important words)
    # Simple keyword extraction - remove common stop words
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "be", "been", "being", 
                  "have", "has", "had", "do", "does", "did", "will", "would", "should",
                  "can", "could", "may", "might", "must", "to", "of", "in", "on", "at",
                  "for", "with", "by", "from", "as", "about", "into", "through", "during"}
    
    words = re.findall(r'\b[a-z]+\b', query_lower)
    keywords = [w for w in words if w not in stop_words and len(w) > 2]
    intent["keywords"] = keywords[:10]  # Top 10 keywords
    
    # Determine intent type
    if len(intent["document_types"]) == 1:
        intent["intent_type"] = "specific_doc_type"
    elif "compare" in query_lower or "difference" in query_lower or "versus" in query_lower:
        intent["intent_type"] = "comparison"
    elif intent["time_references"]:
        intent["intent_type"] = "temporal"
    elif "list" in query_lower or "all" in query_lower or "show" in query_lower:
        intent["intent_type"] = "list"
    
    return intent


def enhance_query(query: str, intent: Optional[Dict] = None) -> str:
    """
    Enhance query with context and synonyms for better semantic search.
    """
    if intent is None:
        intent = extract_query_intent(query)
    
    enhanced_parts = [query]
    
    # Add document type context
    if intent["document_types"]:
        doc_type_context = {
            "proposal": "proposal document content summary scope approach timeline",
            "questionnaire": "questionnaire questions asked to customer",
            "questionnaire_response": "customer response answers what they said replied",
            "requirements": "requirements needs specifications technical requirements",
            "meeting_minutes": "meeting minutes discussion notes what was discussed",
            "email": "email message communication correspondence",
        }
        for doc_type in intent["document_types"]:
            if doc_type in doc_type_context:
                enhanced_parts.append(doc_type_context[doc_type])
    
    # Add question type context
    question_context = {
        "what": "what information details content",
        "who": "who person people responsible",
        "when": "when date time timeline schedule",
        "where": "where location place",
        "why": "why reason rationale explanation",
        "how": "how method process approach steps",
    }
    if intent["question_type"] in question_context:
        enhanced_parts.append(question_context[intent["question_type"]])
    
    # Add keywords for better matching
    if intent["keywords"]:
        enhanced_parts.extend(intent["keywords"][:3])  # Top 3 keywords
    
    return " ".join(enhanced_parts)


def create_query_variations(query: str) -> List[str]:
    """
    Create query variations for better retrieval.
    """
    variations = [query]
    
    # Add variations with synonyms/common terms
    synonyms = {
        "said": ["mentioned", "stated", "replied", "answered", "responded"],
        "requirements": ["needs", "specifications", "needs", "demands"],
        "proposal": ["suggestion", "plan", "recommendation"],
        "questionnaire": ["questions", "survey", "form"],
    }
    
    query_lower = query.lower()
    for term, syns in synonyms.items():
        if term in query_lower:
            for syn in syns[:2]:  # Limit variations
                variation = query_lower.replace(term, syn)
                if variation != query_lower:
                    variations.append(variation)
    
    return variations[:3]  # Limit to 3 variations
