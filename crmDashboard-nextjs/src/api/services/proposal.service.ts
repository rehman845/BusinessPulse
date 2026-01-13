/**
 * Proposal Service
 * Generates proposals based on customer documents (including questionnaire responses)
 */

import { apiClient } from "../client";

export interface Proposal {
  id: string;
  customer_id: string;
  questionnaire_id?: string;
  content: string;
  created_at?: string;
}

export const proposalService = {
  /**
   * Generate proposal for a customer/project using all their documents (via SSR API route)
   */
  async generateProposal(customerId: string, projectId?: string | null) {
    const url = projectId
      ? `/customers/${customerId}/proposal/generate?project_id=${projectId}`
      : `/customers/${customerId}/proposal/generate`;
    const response = await apiClient.post<Proposal>(url);
    return response.data;
  },

  /**
   * Download proposal PDF (via SSR API route)
   */
  async downloadProposalPDF(customerId: string, proposalId: string) {
    // Use Next.js API route (SSR) - backend URL is never exposed
    const url = `/api/customers/${customerId}/proposal/${proposalId}/pdf`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        message: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `proposal_${proposalId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};

