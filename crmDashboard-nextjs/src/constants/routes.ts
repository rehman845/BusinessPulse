/**
 * Application Routes
 * Centralized route constants to avoid hardcoded strings
 */

export const ROUTES = {
  HOME: "/",
  DASHBOARD: {
    ROOT: "/dashboard",
    AGREEMENTS: {
      ROOT: "/dashboard/agreements",
      ACTIVE: "/dashboard/agreements/active",
      EXPIRED: "/dashboard/agreements/expired",
    },
    PROJECTS: "/dashboard/projects",
    INVOICES: {
      ROOT: "/dashboard/invoices",
      PAID: "/dashboard/invoices/paid",
      OVERDUE: "/dashboard/invoices/overdue",
    },
    PRODUCTS: "/dashboard/products",
    REPORTS: "/dashboard/reports",
    DOCUMENTS: "/dashboard/documents",
    FORMS: "/dashboard/forms",
    CHATBOT: "/dashboard/chatbot",
  },
} as const;

export type Routes = typeof ROUTES;

