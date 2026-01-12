import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format document type for display
 * Maps internal doc_type values to user-friendly display names
 */
export function formatDocType(docType: string): string {
  const typeMap: Record<string, string> = {
    questionnaire: "Questionnaire",
    questionnaire_response: "Questionnaire Response",
    proposal: "Proposal",
    meeting_minutes: "Meeting Minutes",
    requirements: "Requirements",
    email: "Email",
  };
  
  return typeMap[docType] || docType.split("_").map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(" ");
}


