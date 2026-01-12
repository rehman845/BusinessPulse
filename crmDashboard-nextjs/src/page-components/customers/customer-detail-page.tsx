"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  customersService,
  documentsService,
  questionnaireService,
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
import { Loader2, Upload, FileText, FileQuestion, FileSignature, FolderOpen, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  const [docType, setDocType] = useState<DocType>("meeting_minutes");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [generatingQn, setGeneratingQn] = useState(false);
  const [sortField, setSortField] = useState<"filename" | "type" | "uploaded_at">("uploaded_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Get projects for this customer
  const customerProjects = useMemo(() => {
    return allProjectsList.filter((p) => p.customerId === customerId);
  }, [allProjectsList, customerId]);

  // Group documents by project_id
  const groupedDocuments = useMemo(() => {
    // Sort function
    const sortDocuments = (docs: Document[]) => {
      const sorted = [...docs].sort((a, b) => {
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
      
      return sorted;
    };

    const grouped: Record<string, { project: Project | null; documents: Document[] }> = {};
    
    // Initialize with "General" group (no project)
    grouped["general"] = { project: null, documents: [] };

    // Group by project_id
    documents.forEach((doc) => {
      const key = doc.project_id || "general";
      if (!grouped[key]) {
        const project = customerProjects.find((p) => p.id === key);
        grouped[key] = { project: project || null, documents: [] };
      }
      grouped[key].documents.push(doc);
    });

    // Sort documents in each group
    Object.keys(grouped).forEach((key) => {
      grouped[key].documents = sortDocuments(grouped[key].documents);
    });

    return grouped;
  }, [documents, customerProjects, sortField, sortDirection]);

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
      const docs = await documentsService.getCustomerDocuments(customerId);
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
      await documentsService.uploadDocument(customerId, docType, file, selectedProjectId || undefined);
      toast.success("Document uploaded");
      setFile(null);
      setSelectedProjectId(null);
      const input = document.getElementById("customer-doc-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await fetchDocuments();
    } catch (error: any) {
      toast.error("Failed to upload document", { description: error.message || "Please try again" });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateQuestionnaire = async () => {
    try {
      setGeneratingQn(true);
      const result = await questionnaireService.generateQuestionnaire(customerId);
      await questionnaireService.downloadQuestionnairePDF(customerId, result.questionnaire_id);
      toast.success("Questionnaire generated and downloaded");
    } catch (error: any) {
      toast.error("Failed to generate questionnaire", { description: error.message || "Please try again" });
    } finally {
      setGeneratingQn(false);
    }
  };

  const handleDocumentClick = async (documentId: string) => {
    try {
      await documentsService.downloadDocument(customerId, documentId);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Customer workspace – upload documents, generate questionnaires, and create proposals.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/customers")}>
          Back to Customers
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: document upload & list */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload meeting minutes, emails, and requirements related to this customer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                        <SelectItem value="requirements">Requirements</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedProjectId || "none"}
                      onValueChange={(v) => setSelectedProjectId(v === "none" ? null : v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Project (Optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General (No Project)</SelectItem>
                        {customerProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.projectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      id="customer-doc-file"
                      type="file"
                      onChange={handleFileChange}
                      className="flex-1"
                      disabled={uploading}
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
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>All documents uploaded for this customer, grouped by project</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDocs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedDocuments).map(([key, { project, documents: projectDocs }]) => {
                    if (projectDocs.length === 0) return null;
                    
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-sm">
                            {project ? (
                              <Link
                                href={`/dashboard/projects/${project.id}`}
                                className="text-primary hover:underline"
                              >
                                {project.projectName}
                              </Link>
                            ) : (
                              "General Documents"
                            )}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            ({projectDocs.length} {projectDocs.length === 1 ? "document" : "documents"})
                          </span>
                        </div>
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {projectDocs.map((doc) => (
                              <TableRow 
                                key={doc.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleDocumentClick(doc.id)}
                              >
                                <TableCell className="font-medium text-primary hover:underline">
                                  {doc.filename}
                                </TableCell>
                                <TableCell>
                                  {formatDocType(doc.doc_type)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {doc.uploaded_at
                                    ? new Date(doc.uploaded_at).toLocaleString()
                                    : "N/A"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: actions for questionnaire & proposal */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Questionnaire</CardTitle>
              <CardDescription>
                Generate an engineering-focused clarification questionnaire using the uploaded documents and a fixed
                prompt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleGenerateQuestionnaire} disabled={generatingQn}>
                {generatingQn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileQuestion className="mr-2 h-4 w-4" />
                    Generate Questionnaire
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                The questionnaire is generated using all current documents for this customer. You can download or view it
                from the Questionnaire area later.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposal</CardTitle>
              <CardDescription>
                After the customer fills the questionnaire, upload their response as a document and generate a proposal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/customers/${customerId}/proposal`)}
              >
                <FileSignature className="mr-2 h-4 w-4" />
                Go to Proposal Generator
              </Button>
              <p className="text-xs text-muted-foreground">
                The proposal will use all documents for this customer: requirements, emails, meeting minutes,
                questionnaires, and questionnaire responses, combined with a fixed proposal prompt.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


