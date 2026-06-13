/**
 * MIGRATION-SHIM: Re-exports the absorbed ItemFormFields so the cross-page
 * ItemsSelectionModal consumer (chat + projects) keeps working without an
 * additional consumer swap.
 *
 * The legacy global at `components/item-form-fields.tsx` should NOT be
 * deleted until ItemsSelectionModal is rewired to import from this shim
 * (the integrator owns that rewire). Tail task: graduate ItemsSelectionModal
 * fully then delete both this shim and the legacy global.
 */

export { ItemFormFields } from "../[ctx]/components/item-form-fields";
export type { ItemFormFieldsProps } from "../[ctx]/components/item-form-fields";
