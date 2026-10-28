import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Placeholder block shown while content loads; hidden from assistive technology.
 *
 * @param props - Class names and every native div prop.
 * @returns The placeholder.
 */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden data-slot="skeleton" className={cn("animate-pulse rounded-md bg-raised", className)} {...props} />;
}

export { Skeleton };
