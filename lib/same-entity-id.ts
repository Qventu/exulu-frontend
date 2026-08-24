/**
 * Compare two entity ids that arrive from GraphQL with inconsistent scalar
 * types.
 *
 * The backend SDL declares RBAC subject ids as `ID!` (serialised to a **string**
 * — graphql/schemas/index.ts:318-331) but the users table declares its own `id`
 * column as `number`, which maps to `Float` (graphql/utilities/map-types.ts:14)
 * and arrives as a **number**. A plain `===` between the two is therefore always
 * false, which silently broke every RBAC membership check in the UI: shared
 * users were shown as read-only, and permission edits were dropped on save.
 *
 * Null-ish ids never match — `String(undefined) === String(undefined)` would
 * otherwise report two absent ids as equal.
 */
export const sameEntityId = (a: unknown, b: unknown): boolean => {
  if (a === null || a === undefined || a === "") return false;
  if (b === null || b === undefined || b === "") return false;
  return String(a) === String(b);
};

/**
 * Normalise an RBAC *user* id back to the number that `users.id` actually is.
 *
 * Prefer this at the boundary where RBAC data enters component state: it keeps
 * one consistent type in the draft that gets sent back to the API, instead of
 * letting query-sourced strings and search-sourced numbers mix in one array.
 *
 * Only valid for user ids. Role and team ids are uuids — leave those as strings.
 * Non-numeric input is passed through untouched rather than becoming NaN.
 */
export const toNumericId = (id: string | number): number => {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : (id as number);
};
