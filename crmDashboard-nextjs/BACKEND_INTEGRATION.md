# Backend Integration Guide

This guide explains how to use your Context-Aware System backend functionality in the CRM Dashboard frontend.

## 🎯 Overview

Your backend API is now fully integrated into the CRM Dashboard. Three new pages have been created that connect to your backend:

1. **Customers Page** (`/dashboard/customers`) - Manage customers
2. **Documents Page** (`/dashboard/documents`) - Upload and manage customer documents
3. **Questionnaire Page** (`/dashboard/questionnaire`) - Generate AI-powered questionnaires

## 📡 API Services

All backend API calls are handled through service modules in `src/api/services/`:

### Customers Service
```typescript
import { customersService } from "@/api";

// Get all customers
const customers = await customersService.getCustomers();

// Get single customer
const customer = await customersService.getCustomer(customerId);

// Create customer
const newCustomer = await customersService.createCustomer({ name: "John Doe" });
```

### Documents Service
```typescript
import { documentsService } from "@/api";

// Get customer documents
const documents = await documentsService.getCustomerDocuments(customerId);

// Upload document
const document = await documentsService.uploadDocument(
  customerId,
  "meeting_minutes", // or "requirements", "email", "questionnaire"
  file // File object
);
```

### Questionnaire Service
```typescript
import { questionnaireService } from "@/api";

// Generate questionnaire
const result = await questionnaireService.generateQuestionnaire(customerId);
// Returns: { questionnaire_id, data: { sections, notes } }

// Download PDF
await questionnaireService.downloadQuestionnairePDF(customerId, questionnaireId);
```

## 🚀 Using in Your Own Components

### Example: Creating a Custom Component

```typescript
"use client";

import { useState, useEffect } from "react";
import { customersService, type Customer } from "@/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function MyCustomComponent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await customersService.getCustomers();
        setCustomers(data);
      } catch (error: any) {
        toast.error("Failed to load customers", {
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {customers.map((customer) => (
            <li key={customer.id}>{customer.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## 📝 Available Backend Endpoints

Your backend exposes these endpoints (all prefixed with `/customers`):

### Customers
- `GET /customers/` - List all customers
- `POST /customers/` - Create a customer
- `GET /customers/{id}` - Get a customer (if implemented)

### Documents
- `GET /customers/{id}/documents` - List customer documents
- `POST /customers/{id}/documents/upload` - Upload a document

### Questionnaire
- `POST /customers/{id}/questionnaire/generate` - Generate questionnaire
- `GET /customers/{id}/questionnaire/{questionnaire_id}/pdf` - Download PDF

## 🔧 Configuration

The API base URL is configured in `src/api/client.ts`:

```typescript
baseURL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001"
```

To change it, create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
```

## 🎨 UI Components Available

The dashboard uses Shadcn UI components. You can use:

- `Button`, `Input`, `Select`, `Card`
- `Table`, `Badge`, `Dialog`, `Sheet`
- `Toast` (via `sonner` - `toast.success()`, `toast.error()`)
- And many more in `src/components/ui/`

## 📚 Type Definitions

All TypeScript types are available from the API services:

```typescript
import type {
  Customer,
  CustomerCreate,
  Document,
  DocType,
  Questionnaire,
  QuestionnaireSection,
  QuestionnaireQuestion,
} from "@/api";
```

## 🐛 Error Handling

All API services throw errors that you can catch:

```typescript
try {
  const customer = await customersService.createCustomer({ name: "Test" });
  toast.success("Customer created!");
} catch (error: any) {
  toast.error("Failed to create customer", {
    description: error.message || "Unknown error",
  });
}
```

## 🎯 Next Steps

1. **Customize Pages**: Edit the page components in `src/page-components/`
2. **Add Features**: Create new pages/components using the API services
3. **Extend Services**: Add more methods to existing services or create new ones
4. **Style**: Customize the UI using Tailwind CSS and Shadcn components

## 📖 Example: Complete Workflow

```typescript
// 1. Create a customer
const customer = await customersService.createCustomer({ name: "Acme Corp" });

// 2. Upload a document
const file = new File([...], "requirements.pdf");
const document = await documentsService.uploadDocument(
  customer.id,
  "requirements",
  file
);

// 3. Generate questionnaire
const questionnaire = await questionnaireService.generateQuestionnaire(customer.id);

// 4. Download PDF
await questionnaireService.downloadQuestionnairePDF(
  customer.id,
  questionnaire.questionnaire_id
);
```

## 🔗 Navigation

The new pages are automatically added to the sidebar navigation. You can customize the navigation in `src/config/navigation.ts`.

---

**Happy coding!** 🚀


