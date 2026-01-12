"use client";

import { useState, useEffect } from "react";
import { documentsService, customersService, type Document, type Customer, type DocType } from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderOpen, Plus, Upload, Loader2, FileText, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { formatDocType } from "@/lib/utils";

export function DocumentsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocType>("meeting_minutes");
  const [file, setFile] = useState<File | null>(null);
  const [sortField, setSortField] = useState<"filename" | "type" | "uploaded_at">("uploaded_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await customersService.getCustomers();
        setCustomers(data);
      } catch (error: any) {
        toast.error("Failed to load customers");
      }
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [selectedCustomerId]);

  const fetchDocuments = async () => {
    if (!selectedCustomerId) return;
    try {
      setLoading(true);
      const data = await documentsService.getCustomerDocuments(selectedCustomerId);
      setDocuments(data);
    } catch (error: any) {
      toast.error("Failed to load documents", {
        description: error.message || "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  // Sort documents
  const sortedDocuments = [...documents].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case "filename":
        comparison = a.filename.localeCompare(b.filename);
        break;
      case "type":
        comparison = formatDocType(a.doc_type).localeCompare(formatDocType(b.doc_type));
        break;
      case "uploaded_at":
        const dateA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
        const dateB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
        comparison = dateA - dateB;
        break;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const handleSort = (field: "filename" | "type" | "uploaded_at") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Please select a customer first");
      return;
    }
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      setUploading(true);
      await documentsService.uploadDocument(selectedCustomerId, docType, file);
      toast.success("Document uploaded successfully");
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById("fileInput") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      await fetchDocuments();
    } catch (error: any) {
      toast.error("Failed to upload document", {
        description: error.message || "Please try again",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering row click
    if (!selectedCustomerId) return;
    
    try {
      await documentsService.viewDocument(selectedCustomerId, documentId);
    } catch (error: any) {
      toast.error("Failed to view document", {
        description: error.message || "Please try again",
      });
    }
  };

  const handleDownloadDocument = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering row click
    if (!selectedCustomerId) return;
    
    try {
      await documentsService.downloadDocument(selectedCustomerId, documentId);
    } catch (error: any) {
      toast.error("Failed to download document", {
        description: error.message || "Please try again",
      });
    }
  };

  const handleDeleteDocument = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering row click
    
    if (!selectedCustomerId) return;
    
    if (!confirm("Are you sure you want to delete this document? This will remove it from search results but keep the file.")) {
      return;
    }

    try {
      setDeletingId(documentId);
      await documentsService.deleteDocument(selectedCustomerId, documentId);
      toast.success("Document deleted successfully");
      await fetchDocuments();
    } catch (error: any) {
      toast.error("Failed to delete document", {
        description: error.message || "Please try again",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Import formatDocType from utils instead of defining locally

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage customer documents
          </p>
        </div>
      </div>

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Customer</CardTitle>
          <CardDescription>Choose a customer to view or upload documents</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Upload Form */}
      {selectedCustomerId && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>Upload a new document for the selected customer</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="flex gap-4">
                <Select value={docType} onValueChange={(value) => setDocType(value as DocType)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                    <SelectItem value="requirements">Requirements</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="questionnaire">Questionnaire</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="flex-1"
                />
                <Button type="submit" disabled={uploading || !file}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Documents</CardTitle>
          <CardDescription>
            {selectedCustomerId
              ? `${documents.length} ${documents.length === 1 ? "document" : "documents"}`
              : "Select a customer to view documents"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedCustomerId ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Select a customer to view their documents
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  No documents uploaded yet
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => handleSort("filename")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Filename
                      {sortField === "filename" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("type")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Type
                      {sortField === "type" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("uploaded_at")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Uploaded At
                      {sortField === "uploaded_at" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDocuments.map((doc) => {
                  const isViewable = doc.filename.toLowerCase().endsWith('.pdf') || 
                                     doc.filename.toLowerCase().endsWith('.docx') ||
                                     doc.filename.toLowerCase().endsWith('.doc');
                  
                  return (
                    <TableRow 
                      key={doc.id}
                      className="hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">
                        {doc.filename}
                      </TableCell>
                      <TableCell>{formatDocType(doc.doc_type)}</TableCell>
                      <TableCell>
                        {doc.uploaded_at
                          ? new Date(doc.uploaded_at).toLocaleString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isViewable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleViewDocument(doc.id, e)}
                              title="View document"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => handleDownloadDocument(doc.id, e)}
                            title="Download document"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                            disabled={deletingId === doc.id}
                            title="Delete document"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

