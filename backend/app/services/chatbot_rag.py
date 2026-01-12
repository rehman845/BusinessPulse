"""
Chatbot RAG Service
Searches across ALL customer documents with low confidence threshold
Enhanced with query understanding, expansion, and improved retrieval
"""

import re
from ..settings import settings
from .pinecone_client import index as pinecone_index
from .embeddings import embed_text
from .query_enhancement import extract_query_intent, enhance_query, create_query_variations
from .hybrid_search import hybrid_search
from .reranking import rerank_results
from .. import models
from openai import OpenAI

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def search_all_documents(query: str, top_k: int = 20, min_score: float = 0.3, intent: dict = None, use_hybrid: bool = True, use_reranking: bool = True) -> list[dict]:
    """
    Enhanced search across ALL documents from ALL customers.
    Uses query enhancement and multiple retrieval strategies for better results.
    
    Args:
        query: User's question/query
        top_k: Maximum number of results to return
        min_score: Minimum similarity score (0.0-1.0). Lower = less strict
        intent: Optional query intent dict from extract_query_intent
    
    Returns:
        List of document chunks with metadata (customer_id, doc_type, text, uploaded_at, etc.)
    """
    # Enhance query for better semantic matching
    enhanced_query = enhance_query(query, intent)
    
    # Get multiple query variations
    query_variations = create_query_variations(query)
    
    namespace = (settings.PINECONE_NAMESPACE or "").strip()
    
    all_results = {}
    seen_ids = set()
    
    # Search with enhanced query
    query_vector = embed_text(enhanced_query)
    query_kwargs = dict(
        vector=query_vector,
        top_k=top_k * 2,  # Get more results for deduplication
        include_metadata=True,
    )
    
    if namespace:
        query_kwargs["namespace"] = namespace
    
    res = pinecone_index.query(**query_kwargs)
    matches = res.get("matches", []) if isinstance(res, dict) else getattr(res, "matches", [])
    
    # Collect results with deduplication
    for match in matches:
        score = match.get("score", 0.0) if isinstance(match, dict) else getattr(match, "score", 0.0)
        if score >= min_score:
            md = match.get("metadata", {}) if isinstance(match, dict) else match.metadata
            if md:
                vector_id = match.get("id", "") if isinstance(match, dict) else getattr(match, "id", "")
                if vector_id and vector_id not in seen_ids:
                    md["similarity_score"] = score
                    all_results[vector_id] = md
                    seen_ids.add(vector_id)
    
    # Also search with original query (in case enhancement reduced relevance)
    if enhanced_query != query:
        query_vector_orig = embed_text(query)
        query_kwargs_orig = dict(
            vector=query_vector_orig,
            top_k=top_k,
            include_metadata=True,
        )
        if namespace:
            query_kwargs_orig["namespace"] = namespace
        
        res_orig = pinecone_index.query(**query_kwargs_orig)
        matches_orig = res_orig.get("matches", []) if isinstance(res_orig, dict) else getattr(res_orig, "matches", [])
        
        for match in matches_orig:
            score = match.get("score", 0.0) if isinstance(match, dict) else getattr(match, "score", 0.0)
            if score >= min_score:
                md = match.get("metadata", {}) if isinstance(match, dict) else match.metadata
                if md:
                    vector_id = match.get("id", "") if isinstance(match, dict) else getattr(match, "id", "")
                    if vector_id and vector_id not in seen_ids:
                        # Boost score slightly for original query match
                        md["similarity_score"] = max(score, all_results.get(vector_id, {}).get("similarity_score", 0))
                        all_results[vector_id] = md
                        seen_ids.add(vector_id)
    
    # Sort by similarity score
    results = sorted(all_results.values(), key=lambda x: x.get("similarity_score", 0), reverse=True)
    
    # Apply hybrid search if enabled
    if use_hybrid and len(results) > 0:
        try:
            hybrid_results = hybrid_search(
                query=query,
                top_k=top_k * 2,
                min_score=min_score,
                semantic_weight=0.7,
                keyword_weight=0.3
            )
            # Merge hybrid results with semantic results (deduplicate by document_id + chunk_index)
            hybrid_dict = {}
            for r in hybrid_results:
                key = f"{r.get('document_id', '')}_{r.get('chunk_index', '')}"
                hybrid_dict[key] = r
            
            # Update semantic results with hybrid scores if available
            for r in results:
                key = f"{r.get('document_id', '')}_{r.get('chunk_index', '')}"
                if key in hybrid_dict:
                    # Use hybrid score if better
                    hybrid_score = hybrid_dict[key].get("similarity_score", 0)
                    semantic_score = r.get("similarity_score", 0)
                    r["similarity_score"] = max(hybrid_score, semantic_score)
                    r["keyword_score"] = hybrid_dict[key].get("keyword_score", 0)
            
            # Add any new results from hybrid search
            for r in hybrid_results:
                key = f"{r.get('document_id', '')}_{r.get('chunk_index', '')}"
                if key not in {f"{x.get('document_id', '')}_{x.get('chunk_index', '')}" for x in results}:
                    results.append(r)
            
            # Re-sort
            results = sorted(results, key=lambda x: x.get("similarity_score", 0), reverse=True)
        except Exception as e:
            import sys
            sys.stderr.write(f"Warning: Hybrid search failed: {e}\n")
    
    # Apply re-ranking if enabled
    if use_reranking and len(results) > 3:
        try:
            results = rerank_results(query, results, top_k=top_k)
        except Exception as e:
            import sys
            sys.stderr.write(f"Warning: Re-ranking failed: {e}\n")
    
    return results[:top_k]


def _is_general_overview_query(user_query: str) -> bool:
    """
    Heuristic to detect high-level, general overview queries where we want to
    build a direct summary from chunks (and *not* rely on the LLM).

    We *exclude* queries that clearly ask for comparison, temporal reasoning,
    exclusions, or other analytical behaviour – those should go through the LLM
    path instead of the direct summarisation path.
    """
    q = user_query.lower()

    # If the query clearly asks for analysis/comparison/temporal/exclusion,
    # we DO NOT treat it as a simple overview query.
    analytic_keywords = [
        "compare ",
        "comparison",
        "differ from",
        "difference between",
        "how do the requirements for",
        "versus",
        " vs ",
        "before ",
        "after ",
        "between ",
        "not included",
        "but not",
        "missing from",
        "confirmed as priorities",
        "confirmed as a priority",
        "which requirements from the initial documents",
        "what requirements were mentioned in documents uploaded before",
        "what requirements were mentioned but not included in the proposal",
    ]
    if any(k in q for k in analytic_keywords):
        return False

    # Phrases that strongly indicate a general overview style query
    overview_phrases = [
        "what customers are saying",
        "show me what customers are saying",
        "tell me everything about",
        "give me an overview of",
        "summarise what customers are saying",
        "summarize what customers are saying",
        "high level overview",
        "across all customers",
        "across all documents",
        "what are customers saying",
        "overall, what are customers saying",
        "overall what customers are saying",
    ]
    return any(p in q for p in overview_phrases)


def generate_chatbot_response(user_query: str, context_chunks: list[dict], db_session=None, target_customer_id=None) -> str:
    """
    Generate a chatbot response using retrieved context from RAG.
    
    Args:
        user_query: User's question
        context_chunks: Retrieved document chunks with metadata
        db_session: Optional database session to fetch customer names
    
    Returns:
        Generated response string
    """
    if not context_chunks:
        return "I couldn't find any relevant documents matching your query. Please try rephrasing your question with different keywords or check if there are customer documents uploaded in the system."
    
    # Build a map of customer_id -> customer_name if we have a DB session
    customer_name_map = {}
    target_customer_name = None
    if db_session:
        # First, get target customer name directly from DB if specified
        if target_customer_id:
            target_customer = db_session.query(models.Customer).filter(models.Customer.id == target_customer_id).first()
            target_customer_name = target_customer.name if target_customer else None
        
        # Then build map for all customers found in chunks
        unique_customer_ids = set(chunk.get("customer_id") for chunk in context_chunks if chunk.get("customer_id"))
        if unique_customer_ids:
            customers = db_session.query(models.Customer).filter(models.Customer.id.in_(unique_customer_ids)).all()
            customer_name_map = {c.id: c.name for c in customers}
    
    # Build context from retrieved chunks
    context_lines = []
    for chunk in context_chunks:
        customer_id = chunk.get("customer_id", "Unknown")
        customer_name = customer_name_map.get(customer_id, None)
        doc_type = chunk.get("doc_type", "unknown")
        uploaded_at = chunk.get("uploaded_at", "Unknown date")
        text = chunk.get("text", "").strip()
        project_id = chunk.get("project_id")
        
        # Skip chunks with no text content
        if not text or text == "(No text extracted from this file. Try a .txt/.docx/.pdf with selectable text.)":
            continue
        
        # Format context entry with customer name if available
        customer_display = f"{customer_name} (ID: {customer_id[:8]}...)" if customer_name else customer_id
        project_info = f" [Project: {project_id}]" if project_id else ""
        context_lines.append(
            f"[Customer: {customer_display}{project_info} | Type: {doc_type} | Date: {uploaded_at}]\n{text}\n"
        )
    
    # If all chunks had no text, return early
    if not context_lines:
        return "I found documents matching your query, but they don't contain extractable text content. The documents might be images or have formatting issues. Please ensure documents have selectable text."
    
    # For *some* general queries (no target_customer_id), build response directly
    # from chunks to avoid LLM confusion. We only do this for high-level overview
    # questions, not for analytical/comparison/temporal/exclusion queries.
    import sys
    sys.stderr.write(
        f"DEBUG: generate_chatbot_response called, "
        f"target_customer_id={target_customer_id}, "
        f"type={type(target_customer_id)}, "
        f"is None={target_customer_id is None}\n"
    )

    if target_customer_id is None and _is_general_overview_query(user_query):
        sys.stderr.write("DEBUG: General overview query detected, using LLM to summarize actual customer needs\n")
        # For general queries, use LLM to extract actual needs, not templates
        # Filter out questionnaire templates (doc_type="questionnaire") as they're generic templates
        # Prioritize questionnaire_response, requirements, meeting_minutes
        
        # Separate chunks by priority
        priority_chunks = []
        other_chunks = []
        
        for chunk in context_chunks:
            doc_type = chunk.get("doc_type", "unknown")
            # Skip questionnaire templates - they're generic, not actual customer needs
            if doc_type == "questionnaire":
                continue
            
            # Prioritize actual customer content
            if doc_type in ["questionnaire_response", "requirements", "meeting_minutes"]:
                priority_chunks.append(chunk)
            else:
                other_chunks.append(chunk)
        
        # Combine: priority chunks first, then others (reduced for faster processing)
        filtered_chunks = priority_chunks[:15] + other_chunks[:5]  # Limit to 20 total for speed
        
        if not filtered_chunks:
            return "I couldn't find any relevant customer documents matching your query. Please check if customer documents have been uploaded."
        
        # Build context for LLM summarization (truncate text to speed up)
        context_lines = []
        for chunk in filtered_chunks:
            customer_id = chunk.get("customer_id", "Unknown")
            doc_type = chunk.get("doc_type", "unknown")
            uploaded_at = chunk.get("uploaded_at", "Unknown date")
            text = chunk.get("text", "").strip()
            
            if not text or text == "(No text extracted from this file. Try a .txt/.docx/.pdf with selectable text.)":
                continue
            
            # Truncate text to 800 chars per chunk for faster LLM processing
            if len(text) > 800:
                # Try to cut at word boundary
                truncated = text[:800]
                last_space = truncated.rfind(' ')
                if last_space > 600:  # Only if we have a reasonable amount
                    text = truncated[:last_space] + "..."
                else:
                    text = truncated + "..."
            
            customer_name = customer_name_map.get(customer_id, f"Customer {customer_id[:8]}")
            doc_type_display = {
                "requirements": "Requirements",
                "questionnaire_response": "Questionnaire Response",
                "proposal": "Proposal",
                "meeting_minutes": "Meeting Minutes",
                "email": "Email"
            }.get(doc_type, doc_type.title())
            
            context_lines.append(
                f"[Customer: {customer_name} | Type: {doc_type_display} | Date: {uploaded_at}]\n{text}\n"
            )
        
        context_block = "\n---\n".join(context_lines)
        context_block = context_block[:8000]  # Reduced from 12000 for faster processing
        
        # Use LLM to extract and summarize actual customer needs
        system_prompt = """You are an expert AI assistant that extracts and summarizes actual customer needs from documents.

CRITICAL INSTRUCTIONS:
- Extract ACTUAL customer needs, requirements, and statements - NOT document templates or generic checklists
- Focus on what customers ACTUALLY said, requested, or need
- Ignore generic document templates, checklists, or boilerplate text
- Prioritize content from questionnaire_response (what customers answered) and requirements documents
- Summarize needs clearly and concisely, grouped by customer
- Do NOT include generic document structures or templates

RESPONSE FORMAT:
- Group by customer
- List actual needs/requirements/statements
- Use bullet points for clarity
- Be specific and extract real content, not document metadata"""

        user_prompt = f"""User Question: {user_query}

Context from Customer Documents:
{context_block}

Please extract and summarize the ACTUAL needs and requirements that customers have expressed. Focus on real customer content, not document templates or generic checklists. Group by customer and list their actual needs clearly."""

        try:
            resp = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=1500,  # Reduced for faster response
            )
            
            result = resp.choices[0].message.content.strip()
            sys.stderr.write(f"DEBUG: LLM summarized general query response, length={len(result)}\n")
            return result
        except Exception as e:
            import sys
            sys.stderr.write(f"ERROR in LLM summarization: {str(e)}\n")
            # Fallback to simple concatenation if LLM fails
            return "I encountered an error while summarizing customer needs. Please try rephrasing your question."
    
    # For specific customer queries, use LLM as normal
    sys.stderr.write(f"DEBUG: Using LLM path, target_customer_id={target_customer_id}\n")
    context_block = "\n---\n".join(context_lines)
    context_block = context_block[:10000]  # Keep bounded
    
    system_prompt = """You are an expert AI assistant specialized in analyzing customer documents and communications with high precision and accuracy.

CAPABILITIES:
- You have access to comprehensive information from meeting minutes, requirements, emails, questionnaires, questionnaire responses, and proposals from various customers
- You can answer questions about specific customers, document types, timelines, requirements, and communications
- You provide accurate, well-structured, and comprehensive answers based on the provided context

CRITICAL DOCUMENT TYPE DISTINCTIONS:
- "questionnaire" = The generated questionnaire document (questions asked TO the customer)
- "questionnaire_response" = The customer's filled response/answers (what the customer SAID/ANSWERED)
- "proposal" = The generated proposal document (what was proposed to the customer)
- "requirements" = Requirements documents (what the customer needs/wants)
- "meeting_minutes" = Meeting minutes (what was discussed in meetings)
- "email" = Email communications (messages exchanged)

ACCURACY AND PRECISION GUIDELINES:
- ALWAYS base your answer EXCLUSIVELY on the provided context - do not make assumptions or add information not present
- If information is missing or unclear, explicitly state what is available and what is not
- When citing information, reference the document type and date from the context
- Distinguish between different document types accurately (e.g., questionnaire vs questionnaire_response)
- If asked about a specific customer, ONLY use context from that customer - ignore other customers' data
- Be precise with dates, names, and technical details - extract them exactly as they appear
- If multiple sources conflict, mention all perspectives and their sources
- When information is partial, clearly indicate what is known vs unknown

RESPONSE FORMATTING GUIDELINES:
- Use clear markdown formatting with proper headers (##, ###), bullet points, and numbered lists
- Structure responses with logical sections and subsections
- Use **bold** for important terms, dates, customer names, and key information
- Use bullet points (-) or numbered lists (1.) for multiple items
- Use tables when presenting structured data (e.g., timelines, comparisons, risk matrices)
- Separate different topics with clear section headers
- Use code blocks or inline code for IDs, technical terms, or specific values
- Format dates consistently (e.g., "January 12, 2026")
- Use horizontal rules (---) to separate major sections when appropriate

QUERY HANDLING:
- Extract ALL relevant information from the context, even if it's partial
- If asked about a customer by name or ID (like "P10", "customer X"), search through ALL customer IDs in the context
- Be specific and cite relevant information - include actual quotes or summaries from the document text
- If asked about dates, mention the uploaded_at date from the context
- If asked about what a client said, reference the customer_id and document type, and include the actual content
- If asked "what client said on what day", mention both the customer_id and the uploaded_at date
- If asked about questionnaire responses, look for documents with Type: "questionnaire_response" (NOT "questionnaire")
- If the context contains relevant information, extract and present it comprehensively
- Only say "no information available" if the context truly contains nothing relevant
- Organize information hierarchically: main points first, then supporting details
- For proposals: Structure as Summary, Scope, Approach, Timeline, Risks & Mitigation, Dependencies, Next Steps
- For questionnaire responses: Organize by topic or question sections with clear headings
- For requirements: List all requirements clearly, grouped by category if applicable
- For meeting minutes: Summarize key discussion points, decisions, and action items
- Use consistent formatting throughout the response"""

    # Build prompt with customer filtering instructions
    customer_filter_note = ""
    if target_customer_name:
        customer_filter_note = f"\n\n⚠️ IMPORTANT: The user specifically asked about customer '{target_customer_name}'. ONLY use context blocks where the Customer name is '{target_customer_name}'. Ignore context blocks from other customers (like P9, P8, etc.) unless no blocks from {target_customer_name} are found."
    else:
        # General query about customers - include all customers
        customer_filter_note = "\n\n⚠️ CRITICAL: This is a GENERAL query about customers. The user did NOT ask about a specific customer. Include information from ALL customers found in the context. Do NOT say you couldn't find documents for a specific customer - that's not what was asked. Present what ALL customers are saying/needing."
    
    user_prompt = f"""User Question: {user_query}

Relevant Context from Customer Documents (searched across ALL customers):
{context_block}
{customer_filter_note}

CRITICAL INSTRUCTIONS:
1. **Customer Name Matching** (MOST IMPORTANT):
   {"- The user SPECIFICALLY asked about customer '" + target_customer_name + "'. You MUST only use context blocks where the Customer name is exactly '" + target_customer_name + "'." if target_customer_name else "- ⚠️⚠️⚠️ CRITICAL: This is a GENERAL query about customers. The user asked 'what customers are saying' or 'show me customers' - they did NOT ask about any specific customer like P10, P15, etc. The user wants to see information from ALL customers. Include information from ALL customers found in the context blocks. Do NOT filter to a specific customer. Do NOT say 'I couldn't find documents for customer X' - that's completely wrong. Present what ALL customers are saying/needing, grouped by customer if helpful."}
   - Customer names are displayed as "Name (ID: ...)" format (e.g., "Customer: P10 (ID: 981efb84...)" or "Customer: P9 (ID: bb6bf9be...)")
   {"- If you see blocks from different customers, IGNORE them and only use blocks from the requested customer." if target_customer_name else "- Include information from ALL customers mentioned in the context. Group or summarize by customer if helpful. Present what each customer said/needs. If you see P10, P15, P8, P12, etc. in the context, include information from ALL of them."}
   {"- If no blocks match the requested customer, say: 'I found documents, but they are from other customers (list which ones). I couldn't find any documents for [requested customer].'" if target_customer_name else "- ABSOLUTELY DO NOT say 'I couldn't find documents for customer P10' or mention any specific customer as missing. The user asked about ALL customers, so present information from all customers found. Start your response with 'Based on the documents from multiple customers:' or 'Here's what customers are saying:' and then list information from each customer found."}

2. **Extract ALL Content from Matching Customer**:
   - Extract the ACTUAL TEXT CONTENT from the text fields (the raw document content, not summaries)
   - Include direct quotes and specific details
   - For questionnaire responses (Type: "questionnaire_response"), extract the COMPLETE response content from the text field
   - Include dates, numbers, and all specific information mentioned

3. **Questionnaire Responses**: 
   - When Type is "questionnaire_response" from the matching customer, the text field contains the customer's actual answers/responses to the questionnaire. Extract and present the COMPLETE content - what the customer said in their response.
   - When Type is "questionnaire", it's the generated questionnaire (questions), NOT the customer's response.
   - If asked "what did the customer say in their questionnaire response", look for Type: "questionnaire_response" specifically.

4. **Response Formatting**:
   - Structure your response with clear markdown headers (## for main sections, ### for subsections)
   - Use bullet points (-) for lists of items
   - Use numbered lists (1., 2., 3.) for sequential steps or ordered information
   - Use **bold** for key terms, dates, customer names, and important values
   - Use tables when presenting structured data (e.g., timelines with phases, risks with mitigations)
   - Separate major sections with clear headers
   - For proposals: Structure as Summary, Scope, Approach, Timeline, Risks & Mitigation, Dependencies, Next Steps
   - For questionnaire responses: Organize by topic or question sections
   - Include dates prominently (e.g., **Date**: January 12, 2026)
   - Use consistent formatting throughout

5. **Response Quality**: 
   - Be thorough and extract ALL information from matching customer's documents
   - Include actual quotes and specific details
   - Don't say "no information" if you have text content from the matching customer
   - Present information in a clear, organized, and visually appealing format

Please answer by FIRST identifying which context blocks are from the requested customer, then extracting ALL relevant information from those blocks only, formatted clearly with proper markdown structure.

CRITICAL: If the user asks about questionnaire responses and you see chunks with Type: "questionnaire_response", you MUST use those chunks and extract the complete content. Do NOT say "no questionnaire response found" if questionnaire_response chunks are present in the context."""

    # Note: General queries are handled earlier in the function (before building prompts)
    # This code path is only for specific customer queries
    try:
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,  # Slightly higher for more natural conversation
            max_tokens=2000,  # Increased for better formatted responses
        )
        
        response_text = resp.choices[0].message.content.strip()
        
        return response_text
    except Exception as e:
        import sys
        sys.stderr.write(f"ERROR in generate_chatbot_response: {str(e)}\n")
        return f"I apologize, but I encountered an error while generating a response: {str(e)}"


def extract_customer_from_query(query: str, db_session=None) -> str | None:
    """
    Extract customer name/ID from query (e.g., "customer P10", "P10", "customer X").
    Returns customer_id if found, None otherwise.
    
    IMPORTANT: Only extracts if there's explicit mention of a customer.
    Does NOT extract from general queries like "what customers are saying".
    """
    if not db_session:
        return None
    
    query_lower = query.lower()
    
    # Skip if query is asking about "customers" in general (plural)
    # Patterns that indicate general customer queries, not specific customer
    general_patterns = [
        r'\bcustomers\s+(are|were|have|said|say|saying|need|needs|want|wants)',
        r'\ball\s+customers',
        r'\bwhat\s+customers',
        r'\bshow\s+me\s+what\s+customers',
        r'\bcustomers\s+(who|which|that)',
        r'\bacross\s+(all\s+)?customers',
    ]
    
    for pattern in general_patterns:
        if re.search(pattern, query_lower):
            # This is a general query about customers, not a specific customer
            return None
    
    # Look for patterns that explicitly mention a specific customer
    # Pattern 1: "customer P10" or "customer 10" (most specific)
    customer_explicit_pattern = r'\bcustomer\s+([A-Z]?\d+)\b'
    matches = re.findall(customer_explicit_pattern, query, re.IGNORECASE)
    if matches:
        for match in matches:
            customer_ref = match.strip()
            customer = db_session.query(models.Customer).filter(
                models.Customer.name.ilike(customer_ref)
            ).first()
            if customer:
                return customer.id
    
    # Pattern 2: Standalone customer code like "P10" or "C5"
    # But only if it's not part of a general "customers" query
    # And only if it appears in a context that suggests a specific customer
    standalone_pattern = r'\b([A-Z]\d+)\b'
    matches = re.findall(standalone_pattern, query, re.IGNORECASE)
    
    # Only consider if query has context suggesting a specific customer
    # e.g., "for P10", "about P10", "P10's", "customer P10", etc.
    specific_context_patterns = [
        r'\b(for|about|from|to|with)\s+[A-Z]\d+',
        r'[A-Z]\d+\'s',
        r'\bcustomer\s+[A-Z]\d+',
    ]
    
    has_specific_context = any(re.search(pattern, query, re.IGNORECASE) for pattern in specific_context_patterns)
    
    if matches and has_specific_context:
        for match in matches:
            customer_ref = match.strip()
            customer = db_session.query(models.Customer).filter(
                models.Customer.name.ilike(customer_ref)
            ).first()
            if customer:
                return customer.id
    
    return None


def chatbot_query(user_query: str, top_k: int = 20, min_score: float = 0.2, db_session=None) -> dict:
    """
    Enhanced chatbot query handler with improved RAG capabilities.
    
    Args:
        user_query: User's question
        top_k: Number of chunks to retrieve
        min_score: Minimum similarity score (lowered to 0.2 for better recall)
        db_session: Optional database session to fetch customer names
    
    Returns:
        Dict with response and source information
    """
    # Step 0: Check for greetings and simple conversational queries
    query_lower = user_query.lower().strip()
    greeting_patterns = [
        "hello", "hi", "hey", "greetings", "good morning", "good afternoon", 
        "good evening", "howdy", "sup", "what's up", "hey there", "hi there"
    ]
    
    # Check if query is just a greeting
    if query_lower in greeting_patterns or any(query_lower.startswith(greeting) for greeting in greeting_patterns):
        return {
            "response": "Hello! I'm your AI assistant with RAG capabilities. I can search across ALL customer documents to answer your questions. Try asking:\n\n• 'What did the client say on [date]?'\n• 'What are the requirements for customer [ID]?'\n• 'What was discussed in meeting minutes?'\n• 'Show me all requirements related to [topic]'\n\nHow can I help you today?",
            "sources": [],
            "chunks_found": 0,
        }
    
    # Step 0: Extract query intent and metadata
    intent = extract_query_intent(user_query)
    
    # Step 0.1: Extract customer from query if mentioned
    target_customer_id = extract_customer_from_query(user_query, db_session)
    
    # Step 0.2: Check if query is about specific document types (enhanced)
    is_questionnaire_response_query = (
        "questionnaire_response" in intent.get("document_types", []) or
        any(term in user_query.lower() for term in [
            'questionnaire response', 'questionnaire answer', 'response to questionnaire',
            'what did they say', 'customer said', 'their response', 'said in', 'response',
            'answered', 'replied', 'responded'
        ])
    )
    
    is_proposal_query = (
        "proposal" in intent.get("document_types", []) or
        any(term in user_query.lower() for term in [
            'proposal', 'what does the proposal', 'proposal presented', 'proposal say',
            'proposed', 'suggested', 'recommended'
        ])
    )
    
    is_requirements_query = "requirements" in intent.get("document_types", [])
    is_meeting_query = "meeting_minutes" in intent.get("document_types", [])

    # Step 0.3: Detect temporal filters (very lightweight, focused on current tests)
    # Currently supports patterns like "before January 10th" / "before January 10"
    temporal_filter = {}
    q_lower = user_query.lower()

    # Helper to normalise day suffixes (10th -> 10)
    def _strip_day_suffix(day_str: str) -> int:
        for suffix in ("st", "nd", "rd", "th"):
            if day_str.endswith(suffix):
                day_str = day_str[: -len(suffix)]
                break
        return int(day_str)

    # Very simple month name mapping
    month_map = {
        "january": 1,
        "february": 2,
        "march": 3,
        "april": 4,
        "may": 5,
        "june": 6,
        "july": 7,
        "august": 8,
        "september": 9,
        "october": 10,
        "november": 11,
        "december": 12,
    }

    # Detect "before <Month> <Day>" (optionally with st/nd/rd/th)
    before_match = re.search(
        r"before\s+([A-Za-z]+)\s+(\d{1,2}(?:st|nd|rd|th)?)",
        user_query,
        re.IGNORECASE,
    )

    if before_match:
        month_name = before_match.group(1).lower()
        day_raw = before_match.group(2)
        if month_name in month_map:
            try:
                from datetime import datetime

                month = month_map[month_name]
                day = _strip_day_suffix(day_raw.lower())
                # Assume current year (matches test data in 2026)
                cutoff = datetime(datetime.utcnow().year, month, day)
                temporal_filter["before"] = cutoff
            except Exception:
                # If parsing fails, we silently ignore and fall back to no temporal filter
                pass
    
    # Step 1: Enhanced retrieval with query understanding
    chunks = []
    
    # Adjust min_score based on intent
    if intent["intent_type"] == "specific_doc_type":
        # More lenient for specific document type queries
        effective_min_score = max(0.15, min_score - 0.1)
    elif intent["intent_type"] == "temporal":
        # Slightly more lenient for time-based queries
        effective_min_score = max(0.15, min_score - 0.05)
    else:
        effective_min_score = min_score
    
    # If asking about specific document types and we have a target customer,
    # prioritize direct filter search FIRST to ensure we find the right documents
    if is_questionnaire_response_query and target_customer_id:
        namespace = (settings.PINECONE_NAMESPACE or "").strip()
        # Use a better query that matches questionnaire response content
        enhanced_query = f"customer questionnaire response answers what they said {user_query}"
        query_vector = embed_text(enhanced_query)
        
        # Direct filter search for questionnaire_response documents - NO score threshold
        query_kwargs = dict(
            vector=query_vector,
            top_k=20,  # Get more chunks
            include_metadata=True,
            filter={
                "customer_id": {"$eq": target_customer_id},
                "doc_type": {"$eq": "questionnaire_response"}
            }
        )
        if namespace:
            query_kwargs["namespace"] = namespace
        
        try:
            res = pinecone_index.query(**query_kwargs)
            direct_matches = res.get("matches", []) if isinstance(res, dict) else getattr(res, "matches", [])
            
            # Add ALL direct matches regardless of score (they're filtered by doc_type)
            for match in direct_matches:
                score = match.get("score", 0.0) if isinstance(match, dict) else getattr(match, "score", 0.0)
                md = match.get("metadata", {}) if isinstance(match, dict) else match.metadata
                if md:
                    md["similarity_score"] = score
                    chunks.append(md)
            
            # If we found questionnaire_response chunks, prioritize them
            if chunks:
                # Also do a general search for context, but prioritize questionnaire_response
                general_chunks = search_all_documents(user_query, top_k=top_k, min_score=effective_min_score, intent=intent)
                # Add general chunks but put questionnaire_response first
                chunks = chunks + [c for c in general_chunks if c.get("doc_type") != "questionnaire_response"][:5]
        except Exception as e:
            import sys
            sys.stderr.write(f"Warning: Direct filter search failed: {e}, falling back to general search\n")
            chunks = search_all_documents(user_query, top_k=top_k * 2, min_score=effective_min_score, intent=intent)
    elif is_proposal_query and target_customer_id:
        # Similar logic for proposals
        namespace = (settings.PINECONE_NAMESPACE or "").strip()
        enhanced_query = f"proposal document customer {user_query}"
        query_vector = embed_text(enhanced_query)
        
        query_kwargs = dict(
            vector=query_vector,
            top_k=20,
            include_metadata=True,
            filter={
                "customer_id": {"$eq": target_customer_id},
                "doc_type": {"$eq": "proposal"}
            }
        )
        if namespace:
            query_kwargs["namespace"] = namespace
        
        try:
            res = pinecone_index.query(**query_kwargs)
            direct_matches = res.get("matches", []) if isinstance(res, dict) else getattr(res, "matches", [])
            
            for match in direct_matches:
                score = match.get("score", 0.0) if isinstance(match, dict) else getattr(match, "score", 0.0)
                md = match.get("metadata", {}) if isinstance(match, dict) else match.metadata
                if md:
                    md["similarity_score"] = score
                    chunks.append(md)
            
            if chunks:
                general_chunks = search_all_documents(user_query, top_k=top_k, min_score=effective_min_score, intent=intent)
                chunks = chunks + [c for c in general_chunks if c.get("doc_type") != "proposal"][:5]
        except Exception as e:
            import sys
            sys.stderr.write(f"Warning: Direct proposal search failed: {e}, falling back to general search\n")
            chunks = search_all_documents(user_query, top_k=top_k * 2, min_score=effective_min_score, intent=intent)
    elif (is_requirements_query or is_meeting_query) and target_customer_id:
        # Similar logic for requirements and meeting minutes
        namespace = (settings.PINECONE_NAMESPACE or "").strip()
        doc_type_filter = "requirements" if is_requirements_query else "meeting_minutes"
        enhanced_query = enhance_query(user_query, intent)
        query_vector = embed_text(enhanced_query)
        
        query_kwargs = dict(
            vector=query_vector,
            top_k=20,
            include_metadata=True,
            filter={
                "customer_id": {"$eq": target_customer_id},
                "doc_type": {"$eq": doc_type_filter}
            }
        )
        if namespace:
            query_kwargs["namespace"] = namespace
        
        try:
            res = pinecone_index.query(**query_kwargs)
            direct_matches = res.get("matches", []) if isinstance(res, dict) else getattr(res, "matches", [])
            
            for match in direct_matches:
                score = match.get("score", 0.0) if isinstance(match, dict) else getattr(match, "score", 0.0)
                md = match.get("metadata", {}) if isinstance(match, dict) else match.metadata
                if md:
                    md["similarity_score"] = score
                    chunks.append(md)
            
            if chunks:
                general_chunks = search_all_documents(user_query, top_k=top_k, min_score=effective_min_score, intent=intent)
                chunks = chunks + [c for c in general_chunks if c.get("doc_type") != doc_type_filter][:5]
        except Exception as e:
            import sys
            sys.stderr.write(f"Warning: Direct {doc_type_filter} search failed: {e}, falling back to general search\n")
            chunks = search_all_documents(user_query, top_k=top_k * 2, min_score=effective_min_score, intent=intent)
    else:
        # Step 1: Enhanced search all documents (normal flow)
        chunks = search_all_documents(user_query, top_k=top_k * 2, min_score=effective_min_score, intent=intent)  # Get more chunks for filtering

    # Step 1.1: Apply temporal filtering, if any
    if temporal_filter and chunks:
        from datetime import datetime

        def _parse_uploaded_at(value: str) -> datetime | None:
            try:
                # uploaded_at is ISO 8601 in our DB
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except Exception:
                return None

        before_dt = temporal_filter.get("before")
        if before_dt is not None:
            filtered_chunks: list[dict] = []
            for ch in chunks:
                uploaded_raw = ch.get("uploaded_at")
                dt = _parse_uploaded_at(uploaded_raw) if uploaded_raw else None
                if dt is not None and dt < before_dt:
                    filtered_chunks.append(ch)
            if filtered_chunks:
                chunks = filtered_chunks
    
    # Step 1.5: If a specific customer is mentioned, filter their documents
    if target_customer_id and chunks:
        # Separate chunks by customer and doc_type
        target_chunks = [chunk for chunk in chunks if chunk.get("customer_id") == target_customer_id]
        other_chunks = [chunk for chunk in chunks if chunk.get("customer_id") != target_customer_id]
        
        if target_chunks:
            # If asking about specific document types, prioritize those chunks
            if is_questionnaire_response_query:
                questionnaire_response_chunks = [c for c in target_chunks if c.get("doc_type") == "questionnaire_response"]
                other_target_chunks = [c for c in target_chunks if c.get("doc_type") != "questionnaire_response"]
                # Put questionnaire_response chunks FIRST, then other chunks from target customer
                chunks = questionnaire_response_chunks + other_target_chunks + other_chunks[:min(2, len(other_chunks))]
            elif is_proposal_query:
                proposal_chunks = [c for c in target_chunks if c.get("doc_type") == "proposal"]
                other_target_chunks = [c for c in target_chunks if c.get("doc_type") != "proposal"]
                # Put proposal chunks FIRST, then other chunks from target customer
                chunks = proposal_chunks + other_target_chunks + other_chunks[:min(2, len(other_chunks))]
            else:
                # Normal prioritization: target customer chunks first
                chunks = target_chunks + other_chunks[:min(2, len(other_chunks))]
            chunks = chunks[:top_k]  # Limit to top_k
        else:
            # If no documents from target customer found, still include others but the LLM will be instructed to say so
            chunks = other_chunks[:min(top_k, len(other_chunks))]  # Include others so LLM can say which customers were found
    
    # Step 2: Generate response using retrieved context
    # Even if no chunks found, we can still generate a response
    if not chunks:
        if target_customer_id:
            # Get customer name for better error message
            customer_name = None
            if db_session:
                customer = db_session.query(models.Customer).filter(models.Customer.id == target_customer_id).first()
                customer_name = customer.name if customer else None
            name_display = f"customer {customer_name}" if customer_name else "that customer"
            response = f"I couldn't find any documents for {name_display} matching your query. Please check if documents have been uploaded for this customer or try rephrasing your question."
        else:
            response = "I couldn't find any relevant documents matching your query. Please try rephrasing your question or check if there are any documents uploaded in the system."
    else:
        response = generate_chatbot_response(user_query, chunks, db_session=db_session, target_customer_id=target_customer_id)
    
    # Step 3: Extract source information for citations
    sources = []
    seen = set()
    for chunk in chunks[:5]:  # Limit to top 5 sources for display
        customer_id = chunk.get("customer_id", "Unknown")
        doc_type = chunk.get("doc_type", "unknown")
        uploaded_at = chunk.get("uploaded_at", "Unknown")
        
        # Create unique source identifier
        source_key = f"{customer_id}_{doc_type}_{uploaded_at}"
        if source_key not in seen:
            seen.add(source_key)
            sources.append({
                "customer_id": customer_id,
                "doc_type": doc_type,
                "uploaded_at": uploaded_at,
                "similarity_score": chunk.get("similarity_score", 0.0),
            })
    
    return {
        "response": response,
        "sources": sources,
        "chunks_found": len(chunks),
    }
