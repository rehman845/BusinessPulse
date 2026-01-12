"use client";

import { useEffect, useState } from "react";
import { customersService, proposalService, documentsService, type DocType, type Document } from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Sparkles, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface QuestionnaireOption {
  id: string;
  title: string;
  created_at?: string;
}

export function ProposalPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [uploadingResponse, setUploadingResponse] = useState(false);
  const [proposal, setProposal] = useState<any | null>(null);
  const [proposalId, setProposalId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

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

  const fetchDocuments = async () => {
    if (!selectedCustomerId) {
      setDocuments([]);
      return;
    }
    try {
      setLoadingDocs(true);
      const docs = await documentsService.getCustomerDocuments(selectedCustomerId);
      setDocuments(docs || []);
    } catch (error: any) {
      toast.error("Failed to load documents", { description: error.message || "Please try again" });
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCustomerId]);

  const hasQuestionnaireResponse = documents.some((doc) => doc.doc_type === "questionnaire_response");

  const handleResponseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResponseFile(e.target.files[0]);
    }
  };

  const handleUploadResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Select a customer first");
      return;
    }
    if (!responseFile) {
      toast.error("Please select a questionnaire response file");
      return;
    }
    try {
      setUploadingResponse(true);
      await documentsService.uploadDocument(selectedCustomerId, "questionnaire_response" as DocType, responseFile);
      toast.success("Questionnaire response uploaded");
      setResponseFile(null);
      const input = document.getElementById("proposal-response-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await fetchDocuments(); // Refresh documents list
    } catch (error: any) {
      toast.error("Failed to upload response", { description: error.message || "Please try again" });
    } finally {
      setUploadingResponse(false);
    }
  };

  const handleGenerateProposal = async () => {
    if (!selectedCustomerId) {
      toast.error("Select a customer");
      return;
    }
    if (!hasQuestionnaireResponse) {
      toast.error("Please upload a questionnaire response first", {
        description: "A questionnaire response document is required before generating a proposal.",
      });
      return;
    }
    try {
      setGenerating(true);
      const result = await proposalService.generateProposal(selectedCustomerId);
      setProposal(JSON.parse(result.content || "{}"));
      setProposalId(result.id);
      toast.success("Proposal generated");
    } catch (error: any) {
      toast.error("Failed to generate proposal", { description: error.message || "Please try again" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedCustomerId || !proposalId) {
      toast.error("No proposal to download");
      return;
    }
    try {
      setLoading(true);
      await proposalService.downloadProposalPDF(selectedCustomerId, proposalId);
    } catch (error: any) {
      toast.error("Failed to download proposal", { description: error.message || "Please try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proposal Generator</h1>
          <p className="text-muted-foreground mt-2">
            Create client-ready proposals from uploaded documents and questionnaire answers.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Customer & Upload Questionnaire Response</CardTitle>
          <CardDescription>
            Choose a customer, upload their filled questionnaire response document, then generate a proposal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form onSubmit={handleUploadResponse} className="flex flex-col md:flex-row gap-3">
            <Input
              id="proposal-response-file"
              type="file"
              onChange={handleResponseChange}
              disabled={uploadingResponse || !selectedCustomerId}
              className="flex-1"
            />
            <Button type="submit" disabled={uploadingResponse || !responseFile || !selectedCustomerId}>
              {uploadingResponse ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Response
                </>
              )}
            </Button>
          </form>

          {selectedCustomerId && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted">
              {loadingDocs ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-0.5" />
              ) : hasQuestionnaireResponse ? (
                <>
                  <FileText className="h-4 w-4 text-green-600 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Questionnaire response uploaded. You can now generate a proposal.
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Please upload a questionnaire response document before generating a proposal.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleGenerateProposal}
              disabled={generating || !selectedCustomerId || !hasQuestionnaireResponse}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Proposal
                </>
              )}
            </Button>

            {proposalId && (
              <Button variant="secondary" onClick={handleDownload} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {proposal && (
        <Card>
          <CardHeader>
            <CardTitle>Proposal</CardTitle>
            <CardDescription>AI-generated proposal based on all uploaded documents for this customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <section>
              <h3 className="font-semibold mb-1">Summary</h3>
              <p className="text-sm text-muted-foreground">{proposal.summary}</p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Scope</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {(proposal.scope || []).map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Approach</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {(proposal.approach || []).map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Timeline</h3>
              <div className="space-y-2">
                {(proposal.timeline || []).map((phase: any, idx: number) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{phase.phase}</span>
                      <Badge variant="secondary">{phase.duration}</Badge>
                    </div>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {(phase.activities || []).map((act: string, aIdx: number) => (
                        <li key={aIdx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Pricing Assumptions</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {(proposal.pricing_assumptions || []).map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Risks & Mitigations</h3>
              <div className="space-y-2">
                {(proposal.risks || []).map((r: any, idx: number) => (
                  <div key={idx} className="border rounded p-3">
                    <p className="text-sm font-semibold">Risk: {r.risk}</p>
                    <p className="text-sm text-muted-foreground">Mitigation: {r.mitigation}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Dependencies</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {(proposal.dependencies || []).map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Next Steps</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {(proposal.next_steps || []).map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>
          </CardContent>
        </Card>
      )}

      {!proposal && (
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <div className="text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Select a customer, upload their requirements / emails / meeting minutes / questionnaire responses as documents,
                then click Generate Proposal.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

