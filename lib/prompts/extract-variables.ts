/**
 * Extracts all variable names from a prompt template
 * Variables are in the format {{variable_name}}
 * Only alphanumeric characters and underscores are allowed in variable names
 *
 * @param content - The prompt content to extract variables from
 * @returns Array of unique variable names found in the content
 *
 * @example
 * extractVariables("Hello {{name}}, your issue {{issue_id}} is resolved")
 * // Returns: ["name", "issue_id"]
 */
export function extractVariables(content: string): string[] {
  if (!content) return [];

  // Match {{variable_name}} where variable_name contains only alphanumeric and underscore
  const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  const matches = content.matchAll(regex);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables).sort();
}
