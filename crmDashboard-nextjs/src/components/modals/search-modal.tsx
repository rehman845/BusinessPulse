"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { 
  Search,
  FileText,
  ShoppingCart,
  Package,
  Users,
  FileCheck,
  ClipboardList,
  FolderOpen,
  TrendingUp,
  ArrowRight,
  Receipt,
  MessageSquare
} from "lucide-react";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Sample search data
const searchData = [
  // Pages
  { id: 1, title: "Dashboard", type: "page", url: "/dashboard", icon: TrendingUp },
  { id: 2, title: "Agreements", type: "page", url: "/dashboard/agreements", icon: FileCheck },
  { id: 3, title: "Orders", type: "page", url: "/dashboard/orders", icon: ShoppingCart },
  { id: 4, title: "Invoices", type: "page", url: "/dashboard/invoices", icon: Receipt },
  { id: 5, title: "Products & Services", type: "page", url: "/dashboard/products", icon: Package },
  { id: 6, title: "Reports", type: "page", url: "/dashboard/reports", icon: TrendingUp },
  { id: 7, title: "Documents", type: "page", url: "/dashboard/documents", icon: FolderOpen },
  { id: 8, title: "Forms", type: "page", url: "/dashboard/forms", icon: ClipboardList, hidden: true }, // Hidden but kept in code
  { id: 17, title: "Chatbot", type: "page", url: "/dashboard/chatbot", icon: MessageSquare },
  
  // Sample data
  { id: 9, title: "AGR-001 - Service Agreement", type: "agreement", url: "/dashboard/agreements", icon: FileCheck },
  { id: 10, title: "AGR-002 - Partnership Agreement", type: "agreement", url: "/dashboard/agreements", icon: FileCheck },
  { id: 11, title: "ORD-001 - Tech Corp Order", type: "order", url: "/dashboard/orders", icon: ShoppingCart },
  { id: 12, title: "ORD-002 - Global Solutions Order", type: "order", url: "/dashboard/orders", icon: ShoppingCart },
  { id: 13, title: "INV-001 - Website Development", type: "invoice", url: "/dashboard/invoices", icon: Receipt },
  { id: 14, title: "INV-002 - Mobile App Development", type: "invoice", url: "/dashboard/invoices", icon: Receipt },
  { id: 15, title: "Tech Corp Inc.", type: "customer", url: "/dashboard/agreements", icon: Users },
  { id: 16, title: "Global Solutions Ltd", type: "customer", url: "/dashboard/agreements", icon: Users },
];

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState(searchData);

  useEffect(() => {
    // Filter out hidden items
    const visibleData = searchData.filter((item) => !(item as any).hidden);
    
    if (searchQuery.trim() === "") {
      setResults(visibleData);
    } else {
      const filtered = visibleData.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setResults(filtered);
    }
  }, [searchQuery]);

  const handleSelect = (url: string) => {
    router.push(url);
    onOpenChange(false);
    setSearchQuery("");
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "page":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "agreement":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "order":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "invoice":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "customer":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        {/* Search Input */}
        <div className="p-4 border-b">
          <InputGroup>
            <InputGroupInput
              placeholder="Search pages, agreements, orders, invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
            <InputGroupAddon>
              <Search className="h-4 w-4" />
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Search Results */}
        <div className="max-h-[400px] overflow-y-auto">
          <div className="p-2">
            {results.length > 0 ? (
              <div className="space-y-1">
                {results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.url)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left group"
                  >
                    <div className="flex items-center justify-center h-10 w-10 rounded-md bg-muted group-hover:bg-background transition-colors">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <Badge 
                        variant="secondary" 
                        className={`mt-1 text-xs ${getTypeColor(item.type)}`}
                      >
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try searching for something else
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <span>{results.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

