import { LuMoon, LuSun } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

import { useTheme } from "./useTheme";

/**
 * Props of {@link ThemeToggle}.
 */
interface ThemeToggleProps {
  /** Extra classes of the button. */
  className?: string;
}

/**
 * Switches between the light and the dark theme; the choice is remembered.
 *
 * @param props - Extra classes.
 * @returns The toggle button.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const label: string = theme === "dark" ? "Usar tema claro" : "Usar tema oscuro";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={label} className={className} data-tour="theme-toggle">
          {theme === "dark" ? <LuSun aria-hidden /> : <LuMoon aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
