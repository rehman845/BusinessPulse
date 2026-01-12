"""
Hybrid Search: Combines semantic search with keyword matching
"""

import re
from typing import List, Dict
from .pinecone_client import index as pinecone_index
from .embeddings import embed_text
from ..settings import settings


def extract_keywords(query: str) -> List[str]:
    """
    Extract keywords from query for keyword matching.
    """
    # Remove common stop words
    stop_words = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "should",
        "can", "could", "may", "might", "must", "to", "of", "in", "on", "at",
        "for", "with", "by", "from", "as", "about", "into", "through", "during",
        "what", "which", "who", "when", "where", "why", "how", "this", "that",
        "these", "those", "i", "you", "he", "she", "it", "we", "they", "me",
        "him", "her", "us", "them", "my", "your", "his", "her", "its", "our", "their"
    }
    
    # Extract words (alphanumeric, at least 3 chars)
    words = re.findall(r'\b[a-z0-9]{3,}\b', query.lower())
    keywords = [w for w in words if w not in stop_words]
    
    return keywords[:10]  # Top 10 keywords


def keyword_score(text: str, keywords: List[str]) -> float:
    """
    Calculate keyword match score for a text chunk.
    Returns score between 0.0 and 1.0.
    """
    if not keywords:
        return 0.0
    
    text_lower = text.lower()
    matches = sum(1 for keyword in keywords if keyword in text_lower)
    
    # Normalize by number of keywords
    return min(1.0, matches / len(keywords))


def hybrid_search(
    query: str,
    top_k: int = 20,
    min_score: float = 0.2,
    semantic_weight: float = 0.7,
    keyword_weight: float = 0.3,
    filter_dict: Dict = None
) -> List[Dict]:
    """
    Hybrid search combining semantic similarity and keyword matching.
    
    Args:
        query: User's query
        top_k: Number of results to return
        min_score: Minimum combined score threshold
        semantic_weight: Weight for semantic similarity (0.0-1.0)
        keyword_weight: Weight for keyword matching (0.0-1.0)
        filter_dict: Optional Pinecone filter dict
    
    Returns:
        List of chunks with combined scores
    """
    # Ensure weights sum to 1.0
    total_weight = semantic_weight + keyword_weight
    if total_weight != 1.0:
        semantic_weight = semantic_weight / total_weight
        keyword_weight = keyword_weight / total_weight
    
    # Extract keywords
    keywords = extract_keywords(query)
    
    # Semantic search
    query_vector = embed_text(query)
    namespace = (settings.PINECONE_NAMESPACE or "").strip()
    
    query_kwargs = dict(
        vector=query_vector,
        top_k=top_k * 2,  # Get more results for re-ranking
        include_metadata=True,
    )
    
    if filter_dict:
        query_kwargs["filter"] = filter_dict
    
    if namespace:
        query_kwargs["namespace"] = namespace
    
    res = pinecone_index.query(**query_kwargs)
    matches = res.get("matches", []) if isinstance(res, dict) else getattr(res, "matches", [])
    
    # Combine semantic and keyword scores
    results = []
    for match in matches:
        semantic_score = match.get("score", 0.0) if isinstance(match, dict) else getattr(match, "score", 0.0)
        md = match.get("metadata", {}) if isinstance(match, dict) else match.metadata
        
        if not md:
            continue
        
        # Get text for keyword matching
        text = md.get("text", "")
        if not text:
            continue
        
        # Calculate keyword score
        kw_score = keyword_score(text, keywords)
        
        # Combine scores
        combined_score = (semantic_score * semantic_weight) + (kw_score * keyword_weight)
        
        # Apply minimum threshold
        if combined_score >= min_score:
            md["similarity_score"] = combined_score
            md["semantic_score"] = semantic_score
            md["keyword_score"] = kw_score
            results.append(md)
    
    # Sort by combined score
    results.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
    
    return results[:top_k]
