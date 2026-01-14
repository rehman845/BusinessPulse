/**
 * Questionnaire Service
 * Handles all questionnaire-related API calls for Context-Aware System
 */

import { apiClient } from "../client";

export interface QuestionnaireQuestion {
  q: string;
  why: string;
  priority: "high" | "medium" | "low";
}

export interface QuestionnaireSection {
  title: string;
  questions: QuestionnaireQuestion[];
}

export interface Questionnaire {
  customer_id: string;
  sections: QuestionnaireSection[];
  notes?: string;
}

export interface QuestionnaireQuestionItem {
  id: string;
  text: string;
  priority: string;
  topic_category: string;
}

export interface QuestionnaireEnvelope {
  questionnaire_id: string;
  data: Questionnaire;
  questions?: QuestionnaireQuestionItem[];
}

export const questionnaireService = {
  /**
   * Generate questionnaire for a customer/project (via SSR API route)
   */
  async generateQuestionnaire(customerId: string, projectId?: string | null) {
    const url = projectId
      ? `/customers/${customerId}/questionnaire/generate?project_id=${projectId}`
      : `/customers/${customerId}/questionnaire/generate`;
    const response = await apiClient.post<QuestionnaireEnvelope>(url);
    return response.data;
  },

  /**
   * Submit answers for a questionnaire (via SSR API route)
   */
  async submitAnswers(customerId: string, questionnaireId: string, answers: { question_id: string; answer: string }[]) {
    const response = await apiClient.post<{ updated: number }>(
      `/customers/${customerId}/questionnaire/${questionnaireId}/answers`,
      answers
    );
    return response.data;
  },

  /**
   * Download questionnaire PDF (via SSR API route)
   */
  async downloadQuestionnairePDF(customerId: string, questionnaireId: string) {
    // Use Next.js API route (SSR) - backend URL is never exposed
    const url = `/api/customers/${customerId}/questionnaire/${questionnaireId}/pdf`;
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
    link.download = `questionnaire_${questionnaireId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};

