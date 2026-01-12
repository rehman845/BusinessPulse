/**
 * Sidebar Menus Configuration
 * @deprecated Use @/config/navigation instead
 * This file is kept for backward compatibility
 */

import { mainNavigation, secondaryNavigation } from "@/config/navigation";
import type { User } from "@/types";

const defaultUser: User = {
  name: "Admin",
  email: "admin@company.com",
  avatar: "/avatars/avatar.png",
};

export const sidebarMenus = {
  user: defaultUser,
  navMain: mainNavigation,
  navSecondary: secondaryNavigation,
  workspaces: [],
};
