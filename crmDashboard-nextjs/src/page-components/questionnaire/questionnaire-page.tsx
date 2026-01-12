"use client";

import { useState, useEffect } from "react";
import { questionnaireService, customersService, type Customer, type Questionnaire } from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileQuestion, Zap, Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function QuestionnairePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [questionnaireId, setQuestionnaireId] = useState<string>("");
  const [questionsFlat, setQuestionsFlat] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState(false);

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

  const handleGenerate = async () => {
    if (!selectedCustomerId) {
      toast.error("Please select a customer first");
      return;
    }

    try {
      setGenerating(true);
      const result = await questionnaireService.generateQuestionnaire(selectedCustomerId);
      setQuestionnaire(result.data);
      setQuestionnaireId(result.questionnaire_id);
      setQuestionsFlat(result.questions || []);
      const initAnswers: Record<string, string> = {};
      (result.questions || []).forEach((q: any) => {
        initAnswers[q.id] = "";
      });
      setAnswers(initAnswers);
      toast.success("Questionnaire generated successfully!");
    } catch (error: any) {
      toast.error("Failed to generate questionnaire", {
        description: error.message || "Please try again",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedCustomerId || !questionnaireId) {
      toast.error("Missing customer or questionnaire ID");
      return;
    }

    try {
      setLoading(true);
      await questionnaireService.downloadQuestionnairePDF(selectedCustomerId, questionnaireId);
      toast.success("PDF downloaded successfully!");
    } catch (error: any) {
      toast.error("Failed to download PDF", {
        description: error.message || "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSaveAnswers = async () => {
    if (!selectedCustomerId || !questionnaireId || !questionnaire) {
      toast.error("Missing context to save answers");
      return;
    }
    try {
      setSavingAnswers(true);
      const payload: { question_id: string; answer: string }[] = [];
      questionsFlat.forEach((q) => {
        if (answers[q.id] !== undefined) {
          payload.push({ question_id: q.id, answer: answers[q.id] });
        }
      });
      if (payload.length === 0) {
        toast.error("No answers to save");
        return;
      }
      await questionnaireService.submitAnswers(selectedCustomerId, questionnaireId, payload);
      toast.success("Answers saved");
    } catch (error: any) {
      toast.error("Failed to save answers", { description: error.message || "Please try again" });
    } finally {
      setSavingAnswers(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Questionnaire Generator</h1>
          <p className="text-muted-foreground mt-2">
            Generate AI-powered clarification questionnaires for customers
          </p>
        </div>
      </div>

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Customer</CardTitle>
          <CardDescription>Choose a customer to generate a questionnaire</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
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
            <Button onClick={handleGenerate} disabled={generating || !selectedCustomerId}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Generate Questionnaire
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questionnaire Display */}
      {questionnaire && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Questionnaire</CardTitle>
                <CardDescription>AI-generated questions based on customer documents</CardDescription>
              </div>
              <Button onClick={handleDownloadPDF} disabled={loading}>
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <Button variant="secondary" onClick={handleSaveAnswers} disabled={savingAnswers}>
                {savingAnswers ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Answers"
                )}
              </Button>
            </div>
            {questionnaire.notes && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Notes:</strong> {questionnaire.notes}
                </p>
              </div>
            )}

            {questionnaire.sections && questionnaire.sections.length > 0 ? (
              <div className="space-y-6">
                {questionnaire.sections.map((section, sectionIdx) => (
                  <div key={sectionIdx} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b">
                      <h3 className="font-semibold text-gray-900">{section.title}</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {section.questions.map((question, qIdx) => (
                        <div key={qIdx} className="border-l-4 border-indigo-400 pl-4 py-2">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-gray-900 flex-1">
                              {qIdx + 1}. {question.q}
                            </p>
                            <Badge
                              className={`ml-3 ${getPriorityColor(question.priority)}`}
                            >
                              {question.priority.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 italic">
                            <strong>Why:</strong> {question.why}
                          </p>
                          <div className="mt-2">
                            <textarea
                              className="w-full border rounded-md p-2 text-sm"
                              rows={2}
                              placeholder="Type answer..."
                              value={answers[(questionsFlat[qIdx]?.id) || questionsFlat.find((q) => q.text === question.q)?.id || ""] || ""}
                              onChange={(e) =>
                                handleAnswerChange(
                                  (questionsFlat[qIdx]?.id) || (questionsFlat.find((q) => q.text === question.q) || {}).id || "",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <AlertCircle className="h-6 w-6 text-muted-foreground mr-2" />
                <p className="text-muted-foreground">No sections found in questionnaire</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!questionnaire && selectedCustomerId && (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileQuestion className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Click "Generate Questionnaire" to create a questionnaire for this customer
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


