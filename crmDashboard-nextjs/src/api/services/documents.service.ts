/**
 * Documents Service
 * Handles all document-related API calls for Context-Aware System
 */

import { apiClient } from "../client";

export interface Document {
  id: string;
  customer_id: string;
  project_id?: string | null;
  doc_type: string;
  filename: string;
  storage_path: string;
  uploaded_at?: string;
}

export type DocType = "meeting_minutes" | "requirements" | "email" | "questionnaire" | "questionnaire_response" | "proposal";

export interface DocumentUpload {
  doc_type: DocType;
  file: File;
  project_id?: string | null;
}

export const documentsService = {
  /**
   * Get all documents for a customer, optionally filtered by project_id (via SSR API route)
   */
  async getCustomerDocuments(customerId: string, projectId?: string | null): Promise<Document[]> {
    const url = projectId
      ? `/customers/${customerId}/documents?project_id=${projectId}`
      : `/customers/${customerId}/documents`;
    const response = await apiClient.get<Document[]>(url);
    const data = response.data;
    return Array.isArray(data) ? data : [];
  },

  /**
   * View a document inline in browser (for PDFs and DOCX - via SSR API route)
   */
  async viewDocument(customerId: string, documentId: string): Promise<void> {
    // Use Next.js API route (SSR) - backend URL is never exposed
    const response = await fetch(`/api/customers/${customerId}/documents/${documentId}/view`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        message: errorData.error || errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }

    // Get the blob and open in new tab for viewing
    const blob = await response.blob();
    const viewUrl = window.URL.createObjectURL(blob);
    window.open(viewUrl, "_blank");
    // Clean up after a delay to allow the browser to load the blob
    setTimeout(() => window.URL.revokeObjectURL(viewUrl), 100);
  },

  /**
   * Download a document (forces download - via SSR API route)
   */
  async downloadDocument(customerId: string, documentId: string): Promise<void> {
    // Use Next.js API route (SSR) - backend URL is never exposed
    const response = await fetch(`/api/customers/${customerId}/documents/${documentId}/download`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        message: errorData.error || errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }

    // Get filename from Content-Disposition header or use document ID
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `document_${documentId}`;
    if (contentDisposition) {
      // Try to extract filename from Content-Disposition header
      // Handles both quoted and unquoted filenames: filename="file.pdf" or filename=file.pdf
      const quotedMatch = contentDisposition.match(/filename\*?=['"]?([^'";]+)['"]?/i);
      if (quotedMatch && quotedMatch[1]) {
        filename = quotedMatch[1].trim();
        // Remove quotes if present
        filename = filename.replace(/^["']|["']$/g, '');
      }
    }

    // Create blob and force download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },

  async uploadDocument(customerId: string, docType: DocType, file: File, projectId?: string | null) {
    const formData = new FormData();
    formData.append("doc_type", docType);
    formData.append("file", file);
    if (projectId) {
      formData.append("project_id", projectId);
    }

    // Use Next.js API route (SSR) - backend URL is never exposed
    const response = await fetch(`/api/customers/${customerId}/documents`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        message: errorData.error || errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return data;
  },

  /**
   * Delete a document (soft delete - via SSR API route)
   */
  async deleteDocument(customerId: string, documentId: string): Promise<void> {
    const response = await fetch(`/api/customers/${customerId}/documents/${documentId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        message: errorData.error || errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }
  },
};

