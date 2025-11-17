/**
 * Formats a variable name from snake_case to Title Case for display
 *
 * @param variable - The variable name to format (e.g., "customer_name")
 * @returns Formatted string in Title Case (e.g., "Customer Name")
 *
 * @example
 * formatVariableName("customer_name") // Returns: "Customer Name"
 * formatVariableName("issue_id") // Returns: "Issue Id"
 * formatVariableName("firstName") // Returns: "FirstName"
 */
export function formatVariableName(variable: string): string {
  if (!variable) return "";

  return variable
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
