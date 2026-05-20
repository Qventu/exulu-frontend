import { ApolloClient } from "@apollo/client";
import { GET_CONTEXT_BY_ID, GET_ITEM_BY_ID } from "@/queries/queries";

export interface PresetValidationResult {
  isValid: boolean;
  validItems: string[];
  invalidItems: string[];
  missingContexts: string[];
  missingItems: string[];
  totalCount: number;
  validCount: number;
}

interface ParsedItem {
  contextId: string;
  itemId: string | null;
  globalId: string;
}

/**
 * Parse preset items into contexts and specific items
 * Format: "context_id" or "context_id/item_id"
 */
function parsePresetItems(presetItems: string[]): {
  fullContexts: ParsedItem[];
  specificItems: ParsedItem[];
} {
  const fullContexts: ParsedItem[] = [];
  const specificItems: ParsedItem[] = [];

  for (const globalId of presetItems) {
    if (globalId.includes('/')) {
      const [contextId, itemId] = globalId.split('/');
      specificItems.push({ contextId, itemId, globalId });
    } else {
      fullContexts.push({ contextId: globalId, itemId: null, globalId });
    }
  }

  return { fullContexts, specificItems };
}

/**
 * Validate preset items efficiently with batch queries
 *
 * Performance optimizations:
 * - Batches context validation queries
 * - Only validates items for valid contexts
 * - Uses Promise.allSettled for parallel execution
 * - Early returns on empty arrays
 */
export async function validatePresetItems(
  presetItems: string[],
  apolloClient: ApolloClient<any>
): Promise<PresetValidationResult> {
  if (!presetItems || presetItems.length === 0) {
    return {
      isValid: true,
      validItems: [],
      invalidItems: [],
      missingContexts: [],
      missingItems: [],
      totalCount: 0,
      validCount: 0,
    };
  }

  const { fullContexts, specificItems } = parsePresetItems(presetItems);

  const validItems: string[] = [];
  const invalidItems: string[] = [];
  const missingContexts: string[] = [];
  const missingItems: string[] = [];

  // Step 1: Validate all referenced contexts in parallel
  const uniqueContextIds = new Set<string>();
  fullContexts.forEach(item => uniqueContextIds.add(item.contextId));
  specificItems.forEach(item => uniqueContextIds.add(item.contextId));

  const contextValidationPromises = Array.from(uniqueContextIds).map(async (contextId) => {
    try {
      const { data } = await apolloClient.query({
        query: GET_CONTEXT_BY_ID,
        variables: { id: contextId },
        fetchPolicy: 'network-only',
      });
      return { contextId, exists: !!data?.contextById };
    } catch (error) {
      return { contextId, exists: false };
    }
  });

  const contextResults = await Promise.allSettled(contextValidationPromises);
  const validContextIds = new Set<string>();

  contextResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.exists) {
      validContextIds.add(result.value.contextId);
    } else if (result.status === 'fulfilled') {
      missingContexts.push(result.value.contextId);
    }
  });

  // Step 2: Process full contexts
  for (const item of fullContexts) {
    if (validContextIds.has(item.contextId)) {
      validItems.push(item.globalId);
    } else {
      invalidItems.push(item.globalId);
    }
  }

  // Step 3: Validate specific items (only for valid contexts)
  const itemValidationPromises = specificItems
    .filter(item => validContextIds.has(item.contextId))
    .map(async (item) => {
      try {
        // Dynamically construct the query for the specific context
        const { data } = await apolloClient.query({
          query: GET_ITEM_BY_ID(item.contextId, ['id', 'name']),
          variables: { id: item.itemId },
          fetchPolicy: 'network-only',
        });

        const itemKey = `${item.contextId}_itemsById`;
        return {
          globalId: item.globalId,
          exists: !!data?.[itemKey]
        };
      } catch (error) {
        return { globalId: item.globalId, exists: false };
      }
    });

  const itemResults = await Promise.allSettled(itemValidationPromises);

  itemResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.exists) {
      validItems.push(result.value.globalId);
    } else if (result.status === 'fulfilled') {
      invalidItems.push(result.value.globalId);
      missingItems.push(result.value.globalId);
    }
  });

  // Add items from invalid contexts to invalid list
  specificItems
    .filter(item => !validContextIds.has(item.contextId))
    .forEach(item => {
      invalidItems.push(item.globalId);
    });

  return {
    isValid: invalidItems.length === 0,
    validItems,
    invalidItems,
    missingContexts,
    missingItems,
    totalCount: presetItems.length,
    validCount: validItems.length,
  };
}

/**
 * Quick validation without fetching - just returns structure
 * Use this for UI display before full validation
 */
export function parsePresetItemsForDisplay(presetItems: string[]): {
  contextCount: number;
  itemCount: number;
  contextIds: string[];
} {
  const { fullContexts, specificItems } = parsePresetItems(presetItems);
  const uniqueContextIds = new Set<string>();

  fullContexts.forEach(item => uniqueContextIds.add(item.contextId));
  specificItems.forEach(item => uniqueContextIds.add(item.contextId));

  return {
    contextCount: fullContexts.length,
    itemCount: specificItems.length,
    contextIds: Array.from(uniqueContextIds),
  };
}
