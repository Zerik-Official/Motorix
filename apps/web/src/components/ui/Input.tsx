import { Input as InputPrimitive } from "@base-ui/react/input";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Text field of the app; marks itself invalid through `aria-invalid`.
 *
 * @param props - Class names and every native input prop.
 * @returns The input.
 */
function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-panel px-3 py-1 text-[0.9375rem] text-fg transition-colors outline-none placeholder:text-fg-faint focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Multi-line text field with the same look as {@link Input}.
 *
 * @param props - Class names and every native textarea prop.
 * @returns The textarea.
 */
function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full min-w-0 rounded-md border border-input bg-panel px-3 py-2 text-[0.9375rem] text-fg transition-colors outline-none placeholder:text-fg-faint focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
