import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { ComponentProps } from "react";
import { LuCheck, LuChevronDown, LuChevronUp } from "react-icons/lu";

import { cn } from "@/lib/utils";

/**
 * Root of a select; holds the value and the open state.
 */
const Select = SelectPrimitive.Root;

/**
 * Group of options inside {@link SelectContent}.
 *
 * @param props - Class names and every Base UI group prop.
 * @returns The group.
 */
function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1 p-1", className)} {...props} />;
}

/**
 * Text of the selected option shown inside the trigger.
 *
 * @param props - Class names and every Base UI value prop.
 * @returns The value.
 */
function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" className={cn("flex flex-1 text-left", className)} {...props} />;
}

/**
 * Button that opens the list of options.
 *
 * @param props - Size, class names, children and every Base UI trigger prop.
 * @returns The trigger.
 */
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit cursor-pointer items-center justify-between gap-1.5 rounded-md border border-input bg-panel py-2 pr-2 pl-3 text-sm whitespace-nowrap text-fg transition-colors outline-none select-none hover:bg-raised focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-placeholder:text-fg-faint data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<LuChevronDown aria-hidden className="size-4 text-fg-subtle" />} />
    </SelectPrimitive.Trigger>
  );
}

/**
 * Floating list of options, rendered in a portal.
 *
 * @param props - Placement, class names, children and every Base UI popup prop.
 * @returns The list.
 */
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger">) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-40 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-line bg-panel text-fg shadow-lg",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/**
 * Label of a {@link SelectGroup}.
 *
 * @param props - Class names and every Base UI group label prop.
 * @returns The label.
 */
function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1 text-xs text-fg-subtle", className)}
      {...props}
    />
  );
}

/**
 * One option of the list, with a check mark when selected.
 *
 * @param props - Class names, children and every Base UI item prop.
 * @returns The option.
 */
function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-1.5 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-raised data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={<span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />}
      >
        <LuCheck aria-hidden className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

/**
 * Line between groups of options.
 *
 * @param props - Class names and every Base UI separator prop.
 * @returns The separator.
 */
function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-line", className)}
      {...props}
    />
  );
}

/**
 * Arrow shown at the top of a long list to scroll it up.
 *
 * @param props - Class names and every Base UI arrow prop.
 * @returns The arrow.
 */
function SelectScrollUpButton({ className, ...props }: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn("top-0 z-10 flex w-full items-center justify-center bg-panel py-1", className)}
      {...props}
    >
      <LuChevronUp aria-hidden className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

/**
 * Arrow shown at the bottom of a long list to scroll it down.
 *
 * @param props - Class names and every Base UI arrow prop.
 * @returns The arrow.
 */
function SelectScrollDownButton({ className, ...props }: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn("bottom-0 z-10 flex w-full items-center justify-center bg-panel py-1", className)}
      {...props}
    >
      <LuChevronDown aria-hidden className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
