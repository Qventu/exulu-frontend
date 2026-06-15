/**
 * Shared section prop contract for the routine workbench. Mirrors
 * /agents/edit/[id]/sections/types.ts.
 */

import type { Routine } from "../../types";
import type { useRoutineEditor, useRoutineWorkbench } from "../hooks";

export interface RoutineSectionProps {
  routine: Routine;
  editor: ReturnType<typeof useRoutineEditor>;
  workbench: ReturnType<typeof useRoutineWorkbench>;
}
