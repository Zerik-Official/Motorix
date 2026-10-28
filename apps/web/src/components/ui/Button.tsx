import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Visual variants and sizes of {@link Button}.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none cursor-pointer focus-visible:ring-3 focus-visible:ring-focus/40 active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg hover:bg-[color-mix(in_oklab,var(--accent),black_8%)]",
        outline: "border-line-strong bg-panel text-fg hover:bg-raised aria-expanded:bg-raised",
        secondary: "bg-raised text-fg hover:bg-raised-2 aria-expanded:bg-raised-2",
        ghost: "text-fg-muted hover:bg-raised hover:text-fg aria-expanded:bg-raised aria-expanded:text-fg",
        destructive: "bg-danger-soft text-danger hover:bg-[color-mix(in_oklab,var(--danger-soft),var(--danger)_15%)]",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5 text-base",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Props of {@link Button}: every prop of the Base UI button plus a variant and a size.
 */
type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

/**
 * Button of the app, built on the Base UI primitive so it is keyboard and screen reader friendly.
 *
 * @param props - Variant, size, class names and every native button prop.
 * @returns The button.
 */
function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants, type ButtonProps };
