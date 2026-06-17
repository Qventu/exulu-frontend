import { gql } from "@apollo/client";

/**
 * GraphQL operations for /settings, colocated per codebase-structure §1.1/§3.2.
 * Copied (and deliberately narrowed) from queries/queries.ts — the monolith
 * itself is untouched; this feature simply stops importing from it.
 *
 * UPDATE_PERSONAL_SYSTEM_PROMPT is narrowed from UPDATE_USER_BY_ID to the one
 * field this page ever writes (`personal_system_prompt`) — same mutation root
 * (`usersUpdateOneById`); unset input fields behave identically to the
 * monolith's unprovided optional variables (the keys/queries.ts precedent).
 * The distinct operation name avoids collisions with the monolith's documents,
 * which other features still load. The selection returns the saved prompt so
 * the page can write the result back into UserContext (settings-config.md U9).
 */
export const UPDATE_PERSONAL_SYSTEM_PROMPT = gql`
  mutation UpdatePersonalSystemPrompt($id: ID!, $personal_system_prompt: String) {
    usersUpdateOneById(id: $id, input: { personal_system_prompt: $personal_system_prompt }) {
      item {
        id
        personal_system_prompt
      }
    }
  }
`;
