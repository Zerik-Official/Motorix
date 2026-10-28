import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Shares the open and close delays of every tooltip below it.
 */
const TooltipProvider = TooltipPrimitive.Provider;

/**
 * Root of one tooltip.
 */
const Tooltip = TooltipPrimitive.Root;

/**
 * Element the tooltip describes; it is linked to the content through `aria-describedby`.
 */
const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Floating text of a tooltip, rendered in a portal.
 */
const TooltipContent = forwardRef<
  ComponentRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs overflow-hidden rounded-md border border-line-strong bg-fg px-2.5 py-1.5 text-xs text-canvas shadow-md",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
