/**
 * Chat handshake barrel — work item 2.12.
 *
 * Chat imports `SaveWorkflowModal` from `@/components/save-workflow-modal`.
 * After the routines redesign, the implementation moved to
 * `app/(application)/workflows/components/routine-editor-dialog.tsx`. This
 * 2-line re-export keeps the chat header's import path resolving byte-stable
 * — the ChatSaveAsRoutineHandshake interface in
 * `app/(application)/workflows/types.ts` is the binding contract.
 *
 * Do NOT add logic here. Bug fixes live in the routines route.
 */
export {
  SaveWorkflowModal,
  RoutineEditorDialog,
} from "@/app/(application)/workflows/components/routine-editor-dialog";
