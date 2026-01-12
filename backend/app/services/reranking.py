"""
Re-ranking using cross-encoder for better result ordering
Uses a simple but effective re-ranking approach
"""

from typing import List, Dict
from ..settings import settings
from openai import OpenAI

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def rerank_results(query: str, results: List[Dict], top_k: int = None) -> List[Dict]:
    """
    Re-rank search results using LLM-based relevance scoring.
    
    Args:
        query: Original user query
        results: List of search result chunks with metadata
        top_k: Optional limit on number of results to return
    
    Returns:
        Re-ranked list of results
    """
    if not results:
        return results
    
    if len(results) <= 3:
        # Too few results to re-rank effectively
        return results
    
    # Limit to top 20 for re-ranking (to avoid token limits)
    results_to_rerank = results[:20]
    
    # Build prompt for LLM to score relevance
    chunks_text = []
    for i, result in enumerate(results_to_rerank):
        text = result.get("text", "")[:500]  # Limit text length
        doc_type = result.get("doc_type", "unknown")
        customer_name = result.get("customer_name", "Unknown")
        chunks_text.append(f"[Result {i+1}]\nType: {doc_type}\nCustomer: {customer_name}\nText: {text}\n")
    
    prompt = f"""You are a relevance scorer. Given a user query and search results, score each result's relevance to the query.

User Query: {query}

Search Results:
{chr(10).join(chunks_text)}

Rate each result from 0.0 to 1.0 based on how relevant it is to the query.
Return ONLY a JSON array of scores in order, like: [0.9, 0.7, 0.5, ...]
Each score corresponds to Result 1, Result 2, etc.
"""
    
    try:
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a relevance scoring assistant. Return only JSON arrays of scores."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,  # Low temperature for consistent scoring
            max_tokens=200,
        )
        
        import json
        scores_text = resp.choices[0].message.content.strip()
        # Extract JSON array
        scores_text = scores_text.strip("[]")
        scores = [float(s.strip()) for s in scores_text.split(",") if s.strip()]
        
        # Update results with re-ranked scores
        if len(scores) == len(results_to_rerank):
            for i, score in enumerate(scores):
                if i < len(results_to_rerank):
                    # Blend original score with re-ranking score
                    original_score = results_to_rerank[i].get("similarity_score", 0)
                    blended_score = (original_score * 0.6) + (score * 0.4)
                    results_to_rerank[i]["similarity_score"] = blended_score
                    results_to_rerank[i]["rerank_score"] = score
        
        # Sort by new scores
        results_to_rerank.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
        
        # Combine with remaining results
        reranked = results_to_rerank + results[20:]
        
        return reranked[:top_k] if top_k else reranked
        
    except Exception as e:
        # If re-ranking fails, return original results
        import sys
        sys.stderr.write(f"Warning: Re-ranking failed: {e}\n")
        return results[:top_k] if top_k else results
