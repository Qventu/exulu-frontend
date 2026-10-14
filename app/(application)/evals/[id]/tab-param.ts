export type EvalSetTab = "results" | "testCases";

/** `?tab=testCases` opens the cases tab; anything else is the results tab. */
export function tabFromParam(raw: string | null): EvalSetTab {
  return raw === "testCases" ? "testCases" : "results";
}
