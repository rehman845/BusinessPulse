/**
 * Site Configuration
 * Centralized configuration for site metadata and settings
 */

export const siteConfig = {
  name: "CRM Dashboard",
  description: "Modern CRM dashboard for managing customer relationships",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  links: {
    github: "https://github.com/yourusername/shadcn-crm-dashboard",
  },
} as const;

export type SiteConfig = typeof siteConfig;

