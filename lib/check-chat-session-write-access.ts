import { AgentSession } from "@/types/models/agent-session";
import { UserWithRole } from "@/types/models/user";
import { sameEntityId } from "@/lib/same-entity-id";

/**
 * Mirrors the backend's `validateWriteAccess`
 * (src/graphql/mutations/index.ts:211-354). Keep the two in step: when they
 * drift, the UI locks people out of chats the API would happily let them write
 * to, which is exactly how the 2026-08-24 read-only reports arose.
 */
export const checkChatSessionWriteAccess = (session: AgentSession, user: UserWithRole) => {
    if (user.super_admin) {
      return true;
    }

    if (session.rights_mode === 'public') {
      return true;
    }

    // The creator can always write to their own session, whatever the sharing
    // mode. Sharing a chat does not add the owner to its own RBAC list, so
    // without this the act of sharing locked the owner out of their own chat
    // ("Read-only — shared by <yourself>"). The backend already returns early
    // for the creator here (mutations/index.ts:282-288).
    if (sameEntityId(session.created_by, user.id)) {
      return true;
    }

    if (session.rights_mode === 'private') {
      return false;
    }

    // sameEntityId, not ===: RBAC subject ids arrive as strings (GraphQL `ID!`)
    // while user.id arrives as a number (`Float`). See lib/same-entity-id.ts.
    if (session.rights_mode === 'users') {
      return session.RBAC?.users?.find(u => sameEntityId(u.id, user.id))?.rights === 'write';
    }

    if (session.rights_mode === 'roles') {
      return session.RBAC?.roles?.find(r => sameEntityId(r.id, user.role?.id))?.rights === 'write';
    }

    // "teams" mode is unhandled here as it always has been — team sharing has
    // no chat-level UI yet. Falling through to false keeps the UI strictly no
    // more permissive than the API.
    return false;
}
