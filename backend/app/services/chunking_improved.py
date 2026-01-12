"""
Improved Chunking Strategy
Better semantic boundaries and context preservation
"""

import re
from typing import List


def chunk_text_improved(text: str, chunk_size: int = 900, overlap: int = 150) -> List[str]:
    """
    Improved chunking that respects sentence boundaries and semantic units.
    
    Strategy:
    1. Split by paragraphs first
    2. Then by sentences
    3. Preserve context with overlap
    4. Ensure chunks don't break mid-sentence
    """
    text = (text or "").strip()
    if not text:
        return []
    
    # Split into paragraphs first
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para_length = len(para)
        
        # If paragraph fits in current chunk, add it
        if current_length + para_length + 2 <= chunk_size:  # +2 for newline
            current_chunk.append(para)
            current_length += para_length + 2
        else:
            # Save current chunk if it has content
            if current_chunk:
                chunk_text = "\n\n".join(current_chunk)
                if chunk_text.strip():
                    chunks.append(chunk_text.strip())
            
            # If paragraph is larger than chunk_size, split by sentences
            if para_length > chunk_size:
                sentences = split_sentences(para)
                for sentence in sentences:
                    sent_length = len(sentence)
                    
                    if current_length + sent_length + 1 <= chunk_size:
                        current_chunk.append(sentence)
                        current_length += sent_length + 1
                    else:
                        # Save current chunk
                        if current_chunk:
                            chunk_text = "\n\n".join(current_chunk)
                            if chunk_text.strip():
                                chunks.append(chunk_text.strip())
                        
                        # Start new chunk with overlap
                        if chunks and overlap > 0:
                            # Get last few sentences from previous chunk for overlap
                            prev_chunk = chunks[-1]
                            overlap_text = get_overlap_text(prev_chunk, overlap)
                            current_chunk = [overlap_text] if overlap_text else []
                            current_length = len(overlap_text) if overlap_text else 0
                        
                        current_chunk.append(sentence)
                        current_length = sent_length
            else:
                # Start new chunk with overlap
                if chunks and overlap > 0:
                    prev_chunk = chunks[-1]
                    overlap_text = get_overlap_text(prev_chunk, overlap)
                    current_chunk = [overlap_text] if overlap_text else []
                    current_length = len(overlap_text) if overlap_text else 0
                
                current_chunk = [para]
                current_length = para_length
    
    # Add final chunk
    if current_chunk:
        chunk_text = "\n\n".join(current_chunk)
        if chunk_text.strip():
            chunks.append(chunk_text.strip())
    
    # Fallback to simple chunking if no good boundaries found
    if not chunks:
        return chunk_text_simple(text, chunk_size, overlap)
    
    return chunks


def split_sentences(text: str) -> List[str]:
    """
    Split text into sentences, preserving punctuation.
    """
    # Pattern to match sentence endings
    sentence_endings = r'[.!?]+(?:\s+|$)'
    sentences = re.split(sentence_endings, text)
    
    # Clean and filter empty sentences
    sentences = [s.strip() for s in sentences if s.strip()]
    
    return sentences


def get_overlap_text(text: str, overlap_size: int) -> str:
    """
    Get the last N characters from text, trying to end at sentence boundary.
    """
    if len(text) <= overlap_size:
        return text
    
    overlap_text = text[-overlap_size:]
    
    # Try to find sentence boundary
    sentence_end = re.search(r'[.!?]\s+', overlap_text)
    if sentence_end:
        # Start from after the sentence ending
        start_idx = sentence_end.end()
        return overlap_text[start_idx:].strip()
    
    # Try to find word boundary
    word_boundary = re.search(r'\s+', overlap_text)
    if word_boundary:
        start_idx = word_boundary.end()
        return overlap_text[start_idx:].strip()
    
    return overlap_text.strip()


def chunk_text_simple(text: str, chunk_size: int = 900, overlap: int = 150) -> List[str]:
    """
    Simple chunking fallback (original implementation).
    """
    text = (text or "").strip()
    if not text:
        return []

    chunks = []
    start = 0
    n = len(text)

    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= n:
            break

        start = max(0, end - overlap)

    return chunks
