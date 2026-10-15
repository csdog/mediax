import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Match `.workspace svg { stroke-width: 1.65 }` so Lucide prop defaults don't diverge. */
const ICON_STROKE = 1.65;

function withActionIconStroke(node: ReactNode) {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const icon = child as ReactElement<{ className?: string; strokeWidth?: number }>;
    return cloneElement(icon, {
      className: cn("size-5", icon.props.className),
      strokeWidth: icon.props.strokeWidth ?? ICON_STROKE,
    });
  });
}

/** Outline icon action used by history records and account rows. */
export function ActionIconButton({
  label,
  disabled,
  className,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={400}
        render={
          <Button
            variant="outline"
            size="icon"
            className={cn("text-foreground", className)}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            {withActionIconStroke(children)}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
