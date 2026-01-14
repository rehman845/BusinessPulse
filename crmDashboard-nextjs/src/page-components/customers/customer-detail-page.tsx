"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  customersService,
  documentsService,
  type Customer,
  type Document,
  type DocType,
} from "@/api";
import { useProjects } from "@/hooks";
import type { Project } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Upload, FileText, ArrowUpDown, ArrowUp, ArrowDown, Eye, Download, Trash2, ArrowLeft, FileUp } from "lucide-react";
import { toast } from "sonner";
import { formatDocType } from "@/lib/utils";
import Link from "next/link";

interface CustomerDetailPageProps {
  customerId: string;
}

export function CustomerDetailPage({ customerId }: CustomerDetailPageProps) {
  const router = useRouter();
  const { allProjectsList } = useProjects();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocType>("invoice");
  const [file, setFile] = useState<File | null>(null);
  const [sortField, setSortField] = useState<"filename" | "type" | "uploaded_at">("uploaded_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Get projects for this customer
  const customerProjects = useMemo(() => {
    return allProjectsList.filter((p) => p.customerId === customerId);
  }, [allProjectsList, customerId]);

  // Sort customer documents (no grouping needed since customer docs don't have project_id)
  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
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
  }, [documents, sortField, sortDirection]);

  useEffect(() => {
    const load = async () => {
      try {
        const c = await customersService.getCustomer(customerId);
        setCustomer(c);
      } catch (error: any) {
        toast.error("Failed to load customer");
      } finally {
        setLoadingCustomer(false);
      }
    };
    load();
  }, [customerId]);

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      // Load only customer documents (not project documents)
      const docs = await documentsService.getCustomerDocuments(customerId, null, "customer");
      setDocuments(docs);
    } catch (error: any) {
      toast.error("Failed to load documents", { description: error.message || "Please try again" });
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [customerId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }
    try {
      setUploading(true);
      // Customer documents don't need project_id
      await documentsService.uploadDocument(customerId, docType, "customer", file);
      toast.success("Document uploaded");
      setFile(null);
      const input = document.getElementById("customer-doc-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await fetchDocuments();
    } catch (error: any) {
      toast.error("Failed to upload document", { description: error.message || "Please try again" });
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentClick = async (documentId: string) => {
    try {
      const doc = documents.find(d => d.id === documentId);
      await documentsService.downloadDocument(customerId, documentId, doc);
    } catch (error: any) {
      toast.error("Failed to open document", {
        description: error.message || "Please try again",
      });
    }
  };

  const handleSort = (field: "filename" | "type" | "uploaded_at") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (loadingCustomer) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return <p className="text-muted-foreground">Customer not found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Customer workspace – upload and manage customer-related documents
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/customers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: document upload & list */}
        <div className="space-y-4">
          <Card className="border-2 border-dashed">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                Upload Customer Documents
              </CardTitle>
              <CardDescription>
                Upload invoices, payment documents, NDAs, contracts, and other customer-related documents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Document Type</label>
                    <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="payment_doc">Payment Document</SelectItem>
                        <SelectItem value="nda">NDA</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="correspondence">Correspondence</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select File</label>
                    <div className="flex gap-3">
                      <Input
                        id="customer-doc-file"
                        type="file"
                        onChange={handleFileChange}
                        className="flex-1"
                        disabled={uploading}
                      />
                      <Button type="submit" disabled={uploading || !file} className="shrink-0">
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
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Customer Documents
              </CardTitle>
              <CardDescription>
                All customer-related documents (invoices, payments, NDAs, contracts, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDocs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No documents uploaded yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Upload invoices, payment documents, NDAs, contracts, or other customer-related documents to get started.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">
                          <button
                            onClick={() => handleSort("filename")}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
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
                        <TableHead className="w-[25%]">
                          <button
                            onClick={() => handleSort("type")}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
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
                        <TableHead className="w-[25%]">
                          <button
                            onClick={() => handleSort("uploaded_at")}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
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
                        <TableHead className="w-[10%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDocuments.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate">{doc.filename}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              {formatDocType(doc.doc_type)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {doc.uploaded_at
                              ? new Date(doc.uploaded_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {(doc.filename.endsWith(".pdf") ||
                                doc.filename.endsWith(".docx") ||
                                doc.filename.endsWith(".doc")) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    documentsService.viewDocument(customerId, doc.id).catch((err) => {
                                      toast.error("Failed to view document", { description: err.message });
                                    });
                                  }}
                                  title="View document"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  documentsService.downloadDocument(customerId, doc.id, doc).catch((err) => {
                                    toast.error("Failed to download document", { description: err.message });
                                  });
                                }}
                                title="Download document"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
                                    documentsService.deleteDocument(customerId, doc.id).then(() => {
                                      toast.success("Document deleted");
                                      fetchDocuments();
                                    }).catch((err) => {
                                      toast.error("Failed to delete document", { description: err.message });
                                    });
                                  }
                                }}
                                title="Delete document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}


