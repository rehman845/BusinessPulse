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
    // Project document types
    questionnaire: "Questionnaire",
    questionnaire_response: "Questionnaire Response",
    proposal: "Proposal",
    meeting_minutes: "Meeting Minutes",
    requirements: "Requirements",
    design_sdd: "Design (SDD)",
    kickoff_meeting: "Kickoff Meeting",
    instruction_manual: "Instruction Manual",
    maintenance_doc: "Maintenance Doc",
    // Customer document types
    invoice: "Invoice",
    payment_doc: "Payment Document",
    nda: "NDA",
    contract: "Contract",
    correspondence: "Correspondence",
    other: "Other",
    // Legacy
    email: "Email",
  };
  
  return typeMap[docType] || docType.split("_").map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(" ");
}


