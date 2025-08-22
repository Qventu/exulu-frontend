/**
 * Utility functions for transforming enums to human-readable labels
 */

/**
 * Transform an enum value (like "TOOL_CALL") to a human-readable label (like "Tool Call")
 */
export function transformEnumToLabel(enumValue: string): string {
  return enumValue
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Transform a group value from API response to a user-friendly format
 * Handles various formats: underscores, camelCase, etc.
 */
export function transformGroupValue(value: string): string {
  if (!value || value.trim() === '') return 'Unknown';
  
  // Handle underscores
  if (value.includes('_')) {
    return value
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Handle camelCase
  const withSpaces = value.replace(/([a-z])([A-Z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

/**
 * Format a number with appropriate locale formatting
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}