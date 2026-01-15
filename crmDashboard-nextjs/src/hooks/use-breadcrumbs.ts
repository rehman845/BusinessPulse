"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface Breadcrumb {
  label: string;
  href: string;
  isCurrent: boolean;
}

/**
 * Mapping of URL segments to their display labels for breadcrumbs
 */
const segmentLabelMap: Record<string, string> = {
  resources: "Partner Companies",
  // Add other custom mappings here as needed
};

/**
 * Hook to generate breadcrumbs from the current pathname
 */
export function useBreadcrumbs(): Breadcrumb[] {
  const pathname = usePathname();

  return useMemo(() => {
    if (!pathname || pathname === "/") return [];

    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs: Breadcrumb[] = [];

    segments.forEach((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");
      // Use custom label mapping if available, otherwise generate from segment
      const label = segmentLabelMap[segment] || segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      breadcrumbs.push({
        label,
        href,
        isCurrent: index === segments.length - 1,
      });
    });

    return breadcrumbs;
  }, [pathname]);
}

