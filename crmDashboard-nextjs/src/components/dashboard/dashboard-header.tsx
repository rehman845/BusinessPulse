"use client";

// External dependencies
import React, { useState } from "react";
import {
  BellIcon,
  SearchIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";

// Internal components
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { NotificationsModal } from "@/components/modals/notifications-modal";
import { SearchModal } from "@/components/modals/search-modal";

/**
 * DashboardHeader Component
 *
 * Main header for the dashboard layout.
 * Contains sidebar toggle, breadcrumbs navigation, search, notifications, and theme toggle.
 */
export const DashboardHeader = () => {
  const { open } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadCount = 2; // Number of unread notifications

  return (
    <>
      <header
        className="flex h-16 shrink-0 items-center justify-between px-4 transition-all duration-200"
        role="banner"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <SidebarTrigger
            icon={
              open ? (
                <PanelLeftCloseIcon aria-hidden="true" />
              ) : (
                <PanelLeftOpenIcon aria-hidden="true" />
              )
            }
            aria-label={open ? "Close sidebar" : "Open sidebar"}
            aria-expanded={open}
            aria-controls="main-sidebar"
          />
          <Separator orientation="vertical" className="h-4" aria-hidden="true" />
          <Breadcrumbs
            homeLabel="Dashboard"
            homeHref="/dashboard"
            className="overflow-hidden"
            showHome={false}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="relative h-9 w-9 rounded-full"
            aria-label="Notifications"
            onClick={() => setNotificationsOpen(true)}
          >
            <BellIcon className="h-4 w-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount}
              </Badge>
            )}
            <span className="sr-only">Notifications</span>
          </Button>

          <ModeToggle />
        </div>
      </header>

      {/* Modals */}
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </>
  );
};
