import { LuCompass } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

import { useAppTour } from "./useAppTour";

/**
 * Opens the guided tour of the app, built for the role of the signed in account.
 *
 * @returns The button.
 */
export function TourButton() {
  const { start, active } = useAppTour();
  const label: string = "Recorrido guiado";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={() => void start()} disabled={active} aria-label={label} data-tour="tour-button">
          <LuCompass aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
