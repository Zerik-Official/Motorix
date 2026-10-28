import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { LuCheck } from "react-icons/lu";

import { cn } from "@/lib/utils";

/**
 * Checkbox of the app, built on the Base UI primitive.
 *
 * @param props - Class names and every Base UI checkbox prop.
 * @returns The checkbox.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-strong bg-panel transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-fg data-checked:bg-fg data-checked:text-canvas",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center">
        <LuCheck aria-hidden className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
