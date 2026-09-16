"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Tooltip from "@/components/ui/tooltip";

//* Libraries Imports
import { Eye, EyeOff } from "lucide-react";

type PrivacyToggleProps = {
  isHidden: boolean;
  onToggle: () => void;
};

export function PrivacyToggle({ isHidden, onToggle }: PrivacyToggleProps) {
  const label = isHidden ? "Mostrar valores" : "Ocultar valores";

  return (
    <Tooltip.TooltipRoot>
      <Tooltip.TooltipTrigger
        render={
          <Button
            type="button"
            variant={isHidden ? "outline" : "secondary"}
            className="h-8 px-3 text-xs font-medium"
            aria-pressed={!isHidden}
            aria-label={label}
            onClick={onToggle}
          />
        }
      >
        {isHidden ? <EyeOff /> : <Eye />}
        {isHidden ? "Valores ocultos" : "Valores visíveis"}
      </Tooltip.TooltipTrigger>
      <Tooltip.TooltipContent side="bottom" sideOffset={8}>
        {label}
      </Tooltip.TooltipContent>
    </Tooltip.TooltipRoot>
  );
}
