/**
 * Chatbot Service
 * Handles chatbot queries with RAG support and session management
 */

import { chatbotApiClient } from "../client";

export interface ChatbotRequest {
  query: string;
  top_k?: number;
  min_score?: number;
  session_id?: string | null;
}

export interface ChatbotSource {
  customer_id: string;
  doc_type: string;
  uploaded_at: string;
  similarity_score: number;
}

export interface ChatbotResponse {
  response: string;
  sources: ChatbotSource[];
  chunks_found: number;
  session_id?: string | null;
}

export interface ChatMessage {
  id: string;
  query: string;
  response: string;
  created_at: string;
  chunks_found: number;
  sources_count: number;
}

export interface ChatSession {
  session_id: string;
  first_query: string;
  last_message_at: string;
  message_count: number;
}

export const chatbotService = {
  /**
   * Send a chat query with RAG support (via SSR API route)
   */
  async chat(request: ChatbotRequest): Promise<ChatbotResponse> {
    const params = new URLSearchParams();
    if (request.session_id) {
      params.append("session_id", request.session_id);
    }
    
    const endpoint = `/chat${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await chatbotApiClient.post<ChatbotResponse>(endpoint, {
      query: request.query,
      top_k: request.top_k || 20,
      min_score: request.min_score || 0.2, // Lower threshold to catch questionnaire responses
    });
    return response.data;
  },

  /**
   * Get all chat sessions
   */
  async getSessions(): Promise<ChatSession[]> {
    const response = await chatbotApiClient.get<ChatSession[]>("/sessions");
    return response.data;
  },

  /**
   * Get chat history for a specific session
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const response = await chatbotApiClient.get<ChatMessage[]>(`/sessions/${sessionId}/messages`);
    return response.data;
  },

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string): Promise<{ message: string; deleted_count: number }> {
    const response = await chatbotApiClient.delete<{ message: string; deleted_count: number }>(`/sessions/${sessionId}`);
    return response.data;
  },
};
