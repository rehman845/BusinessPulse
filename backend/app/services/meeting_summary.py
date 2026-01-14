"""
Meeting Minutes Summarization Service
Generates concise summaries of meeting minutes for RAG efficiency.
Summaries include action items, tool integrations, dates, and important points.
"""

from openai import OpenAI
from ..settings import settings
import logging

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_meeting_summary(full_text: str) -> str:
    """
    Generate a concise summary of meeting minutes for RAG indexing.
    
    The summary focuses on:
    - Action items (what needs to be done, by whom, deadlines)
    - Tool integrations mentioned
    - Important dates and timelines
    - Key discussion points and decisions
    
    Args:
        full_text: Full extracted text from meeting minutes document
        
    Returns:
        Concise summary string optimized for RAG retrieval
    """
    if not full_text or len(full_text.strip()) < 50:
        logger.warning("Meeting minutes text too short for summarization")
        return full_text  # Return original if too short
    
    system_prompt = """You are an expert at summarizing meeting minutes for efficient information retrieval.

Your task is to create a concise, structured summary that captures:
1. **Action Items**: What needs to be done, who is responsible, and deadlines
2. **Tool Integrations**: Any tools, software, platforms, or systems mentioned
3. **Important Dates**: Deadlines, milestones, meeting dates, delivery dates
4. **Key Decisions**: Important decisions made during the meeting
5. **Key Discussion Points**: Critical topics discussed and outcomes

Format the summary clearly with sections. Be specific with dates, names, and action items.
Keep it concise but comprehensive - aim for 20-30% of original length while preserving all critical information.

Example format:
## Action Items
- [Action]: [Responsible person/team] - [Deadline/Date]
- [Action]: [Responsible person/team] - [Deadline/Date]

## Tool Integrations
- [Tool/Platform name]: [Purpose/Context]

## Important Dates
- [Date]: [Event/Milestone]

## Key Decisions
- [Decision made]

## Key Discussion Points
- [Topic]: [Outcome/Summary]
"""

    user_prompt = f"""Summarize the following meeting minutes. Extract action items, tool integrations, dates, decisions, and key discussion points.

Meeting Minutes:
{full_text}

Provide a structured summary focusing on actionable information and important details."""

    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,  # Uses model from env (gpt-4o-mini)
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,  # Lower temperature for more consistent summaries
            max_tokens=2000,  # Allow for comprehensive summaries
        )
        
        summary = response.choices[0].message.content.strip()
        
        if not summary:
            logger.warning("Empty summary generated, using original text")
            return full_text
        
        logger.info(f"Generated meeting summary: {len(summary)} chars (original: {len(full_text)} chars)")
        return summary
        
    except Exception as e:
        logger.error(f"Failed to generate meeting summary: {e}")
        # Fallback: return original text if summarization fails
        return full_text

