/**
 * Validates that a variable name follows the allowed pattern
 * Valid: alphanumeric characters and underscores only
 *
 * @param variable - The variable name to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * validateVariableName("customer_name") // Returns: true
 * validateVariableName("issue-id") // Returns: false (hyphen not allowed)
 * validateVariableName("user@email") // Returns: false (@ not allowed)
 */
export function validateVariableName(variable: string): boolean {
  if (!variable) return false;

  // Only allow alphanumeric characters and underscores
  const validPattern = /^[a-zA-Z0-9_]+$/;
  return validPattern.test(variable);
}

/**
 * Validates all variables in a prompt content
 *
 * @param content - The prompt content to validate
 * @returns Object with isValid boolean and array of invalid variables
 *
 * @example
 * validatePromptVariables("Hello {{name}}, issue {{issue-id}}")
 * // Returns: { isValid: false, invalidVariables: ["issue-id"] }
 */
export function validatePromptVariables(content: string): {
  isValid: boolean;
  invalidVariables: string[];
} {
  if (!content) return { isValid: true, invalidVariables: [] };

  // Match all {{...}} patterns, including invalid ones
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = content.matchAll(regex);
  const invalidVariables: string[] = [];

  for (const match of Array.from(matches)) {
    const variableName = match[1];
    if (!validateVariableName(variableName)) {
      invalidVariables.push(variableName);
    }
  }

  return {
    isValid: invalidVariables.length === 0,
    invalidVariables,
  };
}
