"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2, Bot, User, FileText, Calendar, Building2, Plus, Menu, X, Trash2 } from "lucide-react";
import { chatbotService, type ChatbotResponse, type ChatbotSource, type ChatSession, type ChatMessage } from "@/api";
import { toast } from "sonner";
import { formatDocType } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatbotSource[];
  timestamp: Date;
}

export function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load chat sessions on mount
  useEffect(() => {
    loadChatSessions();
  }, []);

  // Load chat history when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadChatHistory(currentSessionId);
    } else {
      // Show welcome message for new chat
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Hello! I'm your AI assistant with RAG capabilities. I can search across ALL customer documents to answer your questions. Try asking:\n\n• 'What did the client say on [date]?'\n• 'What are the requirements for customer [ID]?'\n• 'What was discussed in meeting minutes?'\n• 'Show me all requirements related to [topic]'\n\nHow can I help you today?",
          timestamp: new Date(),
        },
      ]);
    }
  }, [currentSessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const loadChatSessions = async () => {
    try {
      const sessions = await chatbotService.getSessions();
      setChatSessions(sessions);
    } catch (error: any) {
      console.error("Failed to load chat sessions:", error);
    }
  };

  const loadChatHistory = async (sessionId: string) => {
    try {
      const history = await chatbotService.getHistory(sessionId);
      // Convert ChatMessage[] to Message[]
      const convertedMessages: Message[] = history.flatMap((msg) => [
        {
          id: `${msg.id}-user`,
          role: "user" as const,
          content: msg.query,
          timestamp: new Date(msg.created_at),
        },
        {
          id: msg.id,
          role: "assistant" as const,
          content: msg.response,
          timestamp: new Date(msg.created_at),
        },
      ]);
      setMessages(convertedMessages);
    } catch (error: any) {
      console.error("Failed to load chat history:", error);
      toast.error("Failed to load chat history");
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Hello! I'm your AI assistant with RAG capabilities. I can search across ALL customer documents to answer your questions. Try asking:\n\n• 'What did the client say on [date]?'\n• 'What are the requirements for customer [ID]?'\n• 'What was discussed in meeting minutes?'\n• 'Show me all requirements related to [topic]'\n\nHow can I help you today?",
        timestamp: new Date(),
      },
    ]);
    setInput("");
  };

  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the session when clicking delete
    
    if (!confirm("Are you sure you want to delete this chat session?")) {
      return;
    }

    try {
      await chatbotService.deleteSession(sessionId);
      toast.success("Chat session deleted");
      
      // If we deleted the current session, clear it
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      
      // Reload sessions list
      await loadChatSessions();
    } catch (error: any) {
      toast.error("Failed to delete chat session", {
        description: error.message || error.error || "Please try again",
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const queryText = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const response: ChatbotResponse = await chatbotService.chat({
        query: queryText,
        top_k: 20,
        min_score: 0.2,
        session_id: currentSessionId,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update session ID if this was a new chat
      if (!currentSessionId && response.session_id) {
        setCurrentSessionId(response.session_id);
      }

      // Reload sessions to update message counts
      await loadChatSessions();
    } catch (error: any) {
      const errorMsg = error.message || error.error || "Failed to get response. Please try again.";
      toast.error("Chatbot Error", {
        description: errorMsg,
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I apologize, but I encountered an error: ${errorMsg}. Please try rephrasing your question or try again later.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar - Chat History */}
      {showSidebar && (
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Chat History</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleNewChat}
                  size="sm"
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Chat
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowSidebar(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {chatSessions.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No chat history yet. Start a new conversation!
                  </div>
                ) : (
                  chatSessions.map((session) => (
                    <div
                      key={session.session_id}
                      className={`group relative w-full rounded-lg transition-colors ${
                        currentSessionId === session.session_id
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                      }`}
                    >
                      <button
                        onClick={() => handleSelectSession(session.session_id)}
                        className="w-full text-left p-3 pr-10"
                      >
                        <div className="text-sm font-medium mb-1 line-clamp-2">
                          {session.first_query}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {session.message_count} message{session.message_count !== 1 ? "s" : ""} • {formatDate(session.last_message_at)}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteSession(session.session_id, e)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {!showSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSidebar(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <h1 className="text-3xl font-bold tracking-tight">Chatbot</h1>
            </div>
            <p className="text-muted-foreground mt-2">
              AI-powered assistant with RAG - search across all customer documents
            </p>
          </div>
          {!showSidebar && (
            <Button onClick={handleNewChat} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          )}
        </div>

        {/* Chat Interface */}
        <Card className="flex-1 flex flex-col min-h-[600px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chat Assistant
            </CardTitle>
            <CardDescription>
              Ask questions about customer documents, requirements, meetings, and more
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4" ref={scrollContainerRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {message.role === "user" && (
                          <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        )}
                        {message.role === "assistant" ? (
                          <div className="markdown-content text-sm">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2 text-foreground" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-3 mb-2 text-foreground" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-3 mb-2 text-foreground" {...props} />,
                                p: ({ node, ...props }) => <p className="mb-2 text-sm leading-relaxed text-foreground" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-4 text-foreground" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-4 text-foreground" {...props} />,
                                li: ({ node, ...props }) => <li className="text-sm text-foreground" {...props} />,
                                strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
                                em: ({ node, ...props }) => <em className="italic text-foreground" {...props} />,
                                code: ({ node, className, children, ...props }: any) => {
                                  const isInline = !className || !className.includes('language-');
                                  return isInline ? (
                                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground" {...props}>
                                      {children}
                                    </code>
                                  ) : (
                                    <code className="block bg-muted p-2 rounded text-xs font-mono text-foreground overflow-x-auto" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                pre: ({ node, ...props }) => <pre className="bg-muted p-2 rounded text-xs font-mono text-foreground overflow-x-auto mb-2" {...props} />,
                                table: ({ node, ...props }) => <table className="border-collapse border border-border my-2 w-full text-foreground" {...props} />,
                                thead: ({ node, ...props }) => <thead className="bg-muted" {...props} />,
                                th: ({ node, ...props }) => <th className="border border-border px-2 py-1 text-left text-xs font-semibold text-foreground" {...props} />,
                                td: ({ node, ...props }) => <td className="border border-border px-2 py-1 text-xs text-foreground" {...props} />,
                                hr: ({ node, ...props }) => <hr className="my-3 border-border" {...props} />,
                                blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-border pl-4 italic my-2 text-foreground" {...props} />,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          <p className="text-xs font-semibold opacity-80 mb-2">Sources:</p>
                          {message.sources.map((source, idx) => (
                            <div
                              key={idx}
                              className="text-xs opacity-70 flex flex-wrap items-center gap-2"
                            >
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="h-3 w-3 mr-1" />
                                {source.customer_id.substring(0, 8)}...
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                {formatDocType(source.doc_type)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(source.uploaded_at).toLocaleDateString()}
                              </Badge>
                              <span className="text-xs opacity-60">
                                (Score: {(source.similarity_score * 100).toFixed(1)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-xs opacity-60 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question about customer documents..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
