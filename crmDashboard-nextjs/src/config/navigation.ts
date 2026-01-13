/**
 * Navigation Configuration
 * Centralized navigation structure for the application
 */

import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  FileCheck,
  Package,
  BarChart3,
  FolderOpen,
  ClipboardList,
  HelpCircle,
  Users,
  Briefcase,
  Receipt,
  MessageSquare,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  items?: NavSubItem[];
  hidden?: boolean; // If true, item will be hidden from navigation but code remains
}

export interface NavSubItem {
  title: string;
  url: string;
}

export const mainNavigation: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Agreements",
    url: "/dashboard/agreements",
    icon: FileCheck,
    items: [
      {
        title: "All Agreements",
        url: "/dashboard/agreements",
      },
      {
        title: "Active",
        url: "/dashboard/agreements/active",
      },
      {
        title: "Expired",
        url: "/dashboard/agreements/expired",
      },
    ],
  },
  {
    title: "Projects",
    url: "/dashboard/projects",
    icon: Briefcase,
  },
  {
    title: "Invoices",
    url: "/dashboard/invoices",
    icon: Receipt,
    items: [
      {
        title: "All Invoices",
        url: "/dashboard/invoices",
      },
      {
        title: "Paid",
        url: "/dashboard/invoices/paid",
      },
      {
        title: "Overdue",
        url: "/dashboard/invoices/overdue",
      },
    ],
  },
  {
    title: "Product & Services",
    url: "/dashboard/products",
    icon: Package,
  },
  {
    title: "Reports",
    url: "/dashboard/reports",
    icon: BarChart3,
  },
  {
    title: "Customers",
    url: "/dashboard/customers",
    icon: Users,
  },
  {
    title: "Resources",
    url: "/dashboard/resources",
    icon: UserCog,
  },
  {
    title: "Forms",
    url: "/dashboard/forms",
    icon: ClipboardList,
    hidden: true, // Hidden from navigation but kept in code
  },
  {
    title: "Chatbot",
    url: "/dashboard/chatbot",
    icon: MessageSquare,
  },
];

export const secondaryNavigation: NavItem[] = [];

