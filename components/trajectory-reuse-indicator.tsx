import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Organic, jargon-free indicator that an answer reused a proven earlier approach. Deliberately
 * never says "trajectory". Correction rides the existing 👍/👎 in the message actions (which now
 * target the reused approach), so this component is purely presentational.
 */
export function TrajectoryReuseIndicator() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="gap-1 font-normal text-muted-foreground"
          >
            <History className="size-3" aria-hidden="true" />
            Answered like a similar earlier request
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Handled the same way as an earlier question that worked well. If it&apos;s not right, give
          it a 👎 below.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
