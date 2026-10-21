/**
 * Builds the column mapping for a retry-failed-rows export: the original
 * mapping plus a trailing `import_error` column carrying the per-row failure
 * reason. The extra column is never mapped to a field.
 */
export function retryMapping(
  original: Array<{ header: string; fieldName: string | null }>,
): Array<{ header: string; fieldName: string | null }> {
  return [...original, { header: "import_error", fieldName: null }];
}
