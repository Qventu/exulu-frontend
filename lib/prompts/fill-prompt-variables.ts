/**
 * Fills a prompt template by replacing all {{variable}} placeholders with provided values
 *
 * @param content - The prompt template content with {{variable}} placeholders
 * @param values - Object mapping variable names to their replacement values
 * @returns The filled prompt with all variables replaced
 *
 * @example
 * fillPromptVariables(
 *   "Hello {{name}}, your issue {{issue_id}} is resolved",
 *   { name: "John", issue_id: "123" }
 * )
 * // Returns: "Hello John, your issue 123 is resolved"
 */
export function fillPromptVariables(
  content: string,
  values: Record<string, string>
): string {
  if (!content) return "";
  if (!values || Object.keys(values).length === 0) return content;

  let filled = content;

  for (const [key, value] of Object.entries(values)) {
    // Escape special regex characters in the key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, "g");
    filled = filled.replace(regex, value || "");
  }

  return filled;
}

/**
 * Checks if a prompt has any unfilled variables
 *
 * @param content - The prompt content to check
 * @returns true if there are unfilled {{variable}} placeholders, false otherwise
 *
 * @example
 * hasUnfilledVariables("Hello {{name}}") // Returns: true
 * hasUnfilledVariables("Hello John") // Returns: false
 */
export function hasUnfilledVariables(content: string): boolean {
  if (!content) return false;
  return /\{\{[a-zA-Z0-9_]+\}\}/.test(content);
}
