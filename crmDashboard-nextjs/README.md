# Next.js Dashboard Template

A modern, production-ready dashboard template built with Next.js 15, TypeScript, and Shadcn UI. Designed as a scalable foundation for building dashboard applications.

## ✨ Features

- **🎨 Modern UI** - Built with Shadcn UI and Tailwind CSS
- **📱 Responsive Design** - Works seamlessly on all devices
- **🌙 Dark Mode** - Built-in theme switching
- **🔐 Authentication** - Auth middleware and guards included
- **🎯 TypeScript** - Fully typed for better DX
- **📊 Data Tables** - Advanced table components with sorting, filtering, and pagination
- **🎭 Role-Based Access** - Permission system included
- **🔄 API Layer** - Structured API client and services
- **🛠️ Utility Functions** - Comprehensive utils library
- **📝 Well Documented** - Extensive documentation and examples

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Visit [http://localhost:3000](http://localhost:3000)

**Default Login:**
- Email: `admin@company.com`
- Password: `admin123`

## 📁 Project Structure

```
src/
├── api/              # API client and services
│   ├── client.ts    # Base API client
│   └── services/    # API service modules
├── app/              # Next.js App Router (routes only)
├── components/       # Reusable UI components
│   ├── ui/          # Shadcn UI components
│   ├── shared/      # Shared components
│   ├── dashboard/   # Dashboard components
│   ├── sidebar/     # Sidebar components
│   └── modals/      # Modal components
├── config/          # Configuration files
├── constants/       # Application constants
├── data/            # Mock data
├── hooks/           # Custom React hooks
├── middleware/      # Auth & permission guards
├── pages/           # Page components (separate from routes)
├── providers/       # React context providers
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
    ├── format.ts    # Formatting utilities
    ├── validation.ts # Validation utilities
    ├── string.ts    # String utilities
    ├── array.ts     # Array utilities
    └── date.ts      # Date utilities
```

## 📚 Documentation

- **[Quick Start Guide](./QUICKSTART.md)** - Get started in minutes
- **[Structure Guide](./STRUCTURE.md)** - Detailed project structure explanation
- **[Coding Conventions](./CONVENTIONS.md)** - Coding standards and patterns

## 🎯 Key Principles

### 1. Separation of Concerns
- Routes (`app/`) contain only Next.js routing logic
- Page components (`pages/`) contain the actual UI
- Business logic lives in hooks and services
- Components are reusable across pages

### 2. No Feature Folders
- Organized by technical purpose (types, hooks, utils)
- Avoids nested feature-based structure
- Page-specific components in `components/[page-name]/`

### 3. Type Safety
- Fully typed with TypeScript
- Centralized type definitions
- No `any` types in production code

### 4. Scalability
- Modular architecture
- Easy to add new features
- Clear patterns and conventions

## 🛠️ Tech Stack

- **Framework:** Next.js 15
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn UI
- **Icons:** Lucide React
- **Tables:** TanStack Table
- **Forms:** React Hook Form
- **Date:** date-fns

## 📦 What's Included

### Components
- ✅ Dashboard layout with sidebar
- ✅ Data tables with sorting, filtering, pagination
- ✅ Modal components
- ✅ Form components
- ✅ Loading skeletons
- ✅ Error boundaries

### Pages
- ✅ Login page
- ✅ Dashboard home
- ✅ Orders management
- ✅ Agreements management
- ✅ Products & Services
- ✅ Reports
- ✅ Documents
- ✅ Forms
- ✅ Support

### Utilities
- ✅ Formatting (currency, dates, numbers)
- ✅ Validation (email, phone, password)
- ✅ String manipulation
- ✅ Array operations
- ✅ Date utilities

### API Layer
- ✅ API client with fetch wrapper
- ✅ Authentication service
- ✅ Orders service
- ✅ Error handling
- ✅ Request/response types

### Middleware
- ✅ Authentication guards
- ✅ Role-based access control
- ✅ Permission system
- ✅ HOCs for route protection

## 🎨 Customization

### Theme
Edit `src/app/globals.css` to customize colors:

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  /* ... more variables */
}
```

### Site Config
Edit `src/config/site.ts`:

```typescript
export const siteConfig = {
  name: "Your Dashboard",
  description: "Your description",
  // ...
};
```

### Navigation
Edit `src/config/navigation.ts` to add/remove menu items:

```typescript
export const mainNavigation: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  // Add your items here
];
```

## 🔐 Authentication

### Protecting Routes

```typescript
import { useAuthGuard } from "@/middleware";

export function ProtectedPage() {
  useAuthGuard(); // Redirects if not authenticated
  return <div>Protected Content</div>;
}
```

### Role-Based Access

```typescript
import { useRoleGuard } from "@/middleware";

export function AdminPage() {
  useRoleGuard("admin"); // Only admins can access
  return <div>Admin Panel</div>;
}
```

## 📊 Adding New Features

### 1. Create Types
```typescript
// src/types/customer.ts
export interface Customer {
  id: string;
  name: string;
  email: string;
}
```

### 2. Create API Service
```typescript
// src/api/services/customers.service.ts
export const customersService = {
  async getCustomers() {
    return apiClient.get("/customers");
  },
};
```

### 3. Create Hook
```typescript
// src/hooks/use-customers.ts
export function useCustomers() {
  // Fetch and manage customer data
}
```

### 4. Create Page Component
```typescript
// src/pages/customers/customers-page.tsx
export function CustomersPage() {
  const { customers } = useCustomers();
  return <div>{/* Your UI */}</div>;
}
```

### 5. Create Route
```typescript
// src/app/dashboard/customers/page.tsx
import { CustomersPage } from "@/pages/customers";

export default function Page() {
  return <CustomersPage />;
}
```

## 🧪 Best Practices

1. **Use TypeScript strictly** - Avoid `any` types
2. **Keep components small** - Extract logic into hooks
3. **Use barrel exports** - Import from folder roots
4. **Follow naming conventions** - See CONVENTIONS.md
5. **Document complex logic** - Add JSDoc comments
6. **Test your code** - Write tests for critical paths

## 🤝 Contributing

This is a template project. Feel free to:
- Fork and customize for your needs
- Report issues or suggest improvements
- Share your customizations

## 📄 License

MIT License - feel free to use this template for any project.

## 🆘 Support

- **Documentation:** See guides in `/docs`
- **Issues:** Open an issue on GitHub
- **Questions:** Check QUICKSTART.md and STRUCTURE.md

## 🙏 Credits

Built with:
- [Next.js](https://nextjs.org/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

---

**Made with ❤️ for the developer community**

Start building your next dashboard today! 🚀
