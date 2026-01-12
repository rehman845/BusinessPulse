"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  FileText, 
  ShoppingCart,
  CheckCircle,
  Clock,
  AlertCircle,
  Receipt
} from "lucide-react";

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    orderUpdates: true,
    agreementAlerts: true,
    invoiceUpdates: false,
    systemAlerts: true,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    console.log("Saving notification settings:", settings);
    onOpenChange(false);
  };

  // Sample notifications
  const notifications = [
    {
      id: 1,
      title: "New Order Received",
      description: "Order #ORD-001 has been placed",
      time: "5 minutes ago",
      icon: ShoppingCart,
      type: "success",
      read: false,
    },
    {
      id: 2,
      title: "Agreement Expiring Soon",
      description: "AGR-003 expires in 7 days",
      time: "1 hour ago",
      icon: AlertCircle,
      type: "warning",
      read: false,
    },
    {
      id: 3,
      title: "Invoice Paid",
      description: "INV-002 has been paid by client",
      time: "3 hours ago",
      icon: CheckCircle,
      type: "success",
      read: true,
    },
    {
      id: 4,
      title: "New Message",
      description: "You have a new message from Tech Corp",
      time: "Yesterday",
      icon: MessageSquare,
      type: "info",
      read: true,
    },
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "text-green-500";
      case "warning":
        return "text-orange-500";
      case "info":
        return "text-blue-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </DialogTitle>
          <DialogDescription>
            Manage your notification preferences and view recent alerts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recent Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent Notifications</h3>
              <Button variant="ghost" size="sm">
                Mark all as read
              </Button>
            </div>
            <div className="rounded-md border p-3 space-y-3 max-h-[180px] overflow-y-auto">
              {notifications.slice(0, 2).map((notification) => (
                <div
                  key={notification.id}
                  className={`flex gap-3 p-2 rounded-lg transition-colors ${
                    !notification.read ? "bg-accent" : ""
                  }`}
                >
                  <notification.icon
                    className={`h-4 w-4 mt-0.5 ${getTypeColor(notification.type)}`}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <Badge variant="secondary" className="h-5 text-xs">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {notification.description}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {notification.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Notification Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Notification Settings</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={() => handleToggle("emailNotifications")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Push Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive push notifications in browser
                  </p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onCheckedChange={() => handleToggle("pushNotifications")}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Order Updates
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notifications about order status changes
                  </p>
                </div>
                <Switch
                  checked={settings.orderUpdates}
                  onCheckedChange={() => handleToggle("orderUpdates")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Agreement Alerts
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Alerts for expiring agreements
                  </p>
                </div>
                <Switch
                  checked={settings.agreementAlerts}
                  onCheckedChange={() => handleToggle("agreementAlerts")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Invoice Updates
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Updates on invoice status and payments
                  </p>
                </div>
                <Switch
                  checked={settings.invoiceUpdates}
                  onCheckedChange={() => handleToggle("invoiceUpdates")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    System Alerts
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Important system notifications
                  </p>
                </div>
                <Switch
                  checked={settings.systemAlerts}
                  onCheckedChange={() => handleToggle("systemAlerts")}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Preferences</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

