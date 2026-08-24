import { PromptLibrary } from "@/types/models/prompt-library";
import { UserWithRole } from "@/types/models/user";
import { sameEntityId } from "@/lib/same-entity-id";

/**
 * RBAC predicates for prompts.
 *
 * Every id comparison here goes through `sameEntityId`: RBAC subject ids are
 * `ID!` in the SDL and deserialise to strings, while users.id is `Float` and
 * arrives as a number. Which side is which varies by query, so the comparison
 * is deliberately tolerant of both rather than assuming one. A plain `===`
 * here silently locked shared users out of prompts entirely.
 */

/**
 * Checks if a user has write access to a prompt
 *
 * @param prompt - The prompt to check access for
 * @param user - The user to check access for
 * @returns true if user has write access, false otherwise
 */
export function checkPromptWriteAccess(
  prompt: PromptLibrary,
  user: UserWithRole
): boolean {
  if (user.super_admin) {
    return true;
  }

  // Public: everyone has write access
  if (prompt.rights_mode === "public") {
    return true;
  }

  // The creator can always write to their own prompt, whatever the sharing
  // mode. Sharing does not add the owner to the prompt's own RBAC list, so
  // without this an owner who shared a prompt lost the ability to edit it.
  if (sameEntityId(prompt.created_by, user.id)) {
    return true;
  }

  // Private: creator + admins only, both handled above.
  if (prompt.rights_mode === "private") {
    return false;
  }

  if (prompt.rights_mode === "users") {
    return (
      prompt.RBAC?.users?.find((u) => sameEntityId(u.id, user.id))?.rights ===
      "write"
    );
  }

  if (prompt.rights_mode === "roles") {
    return (
      prompt.RBAC?.roles?.find((r) => sameEntityId(r.id, user.role?.id))
        ?.rights === "write"
    );
  }

  return false;
}

/**
 * Checks if a user has read access to a prompt
 *
 * @param prompt - The prompt to check access for
 * @param user - The user to check access for
 * @returns true if user has read access, false otherwise
 */
export function checkPromptReadAccess(
  prompt: PromptLibrary,
  user: UserWithRole
): boolean {
  // Creator always has read access
  if (sameEntityId(prompt.created_by, user.id)) {
    return true;
  }

  // Admin always has read access
  if (user.super_admin) {
    return true;
  }

  // Private: only creator + admins
  if (prompt.rights_mode === "private") {
    return false;
  }

  // Public: everyone has read access
  if (prompt.rights_mode === "public") {
    return true;
  }

  // By users: presence in the list is enough — read or write both grant read.
  if (prompt.rights_mode === "users") {
    return prompt.RBAC?.users?.find((u) => sameEntityId(u.id, user.id)) !== undefined;
  }

  // By roles: check if user's role has read or write permission
  if (prompt.rights_mode === "roles") {
    return (
      prompt.RBAC?.roles?.find((r) => sameEntityId(r.id, user.role?.id)) !==
      undefined
    );
  }

  // By projects: would need project context to check
  /* if (prompt.rights_mode === "projects") {
    // This would require project context - for now return false
    // Can be enhanced when project context is available
    return false;
  } */

  return false;
}
