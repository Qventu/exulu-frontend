/**
 * Route-local GraphQL operations for /artifacts.
 *
 * `shared_artifacts` is a core table with RBAC (backend
 * src/postgres/core-schema.ts) that joined the generated schema in 2026-10:
 * the generic resolvers apply access control, so this list is exactly what
 * the viewer may read — public links, their own shares, and shares granted
 * to them, their role or their team. `password_hash` is hidden and never
 * selectable. The bytes still come from /shared-artifacts/:name/content.
 *
 * Favourites mirror projects: `users.favourite_artifacts` is a JSON array of
 * share names, read via `userById`, written via `usersUpdateOne` with the
 * `where: { id: { eq } }` form the live schema accepts (app/(application)/
 * projects/queries.ts is the precedent; the older `filter:` form in the
 * global queries file is rejected by the schema).
 */

import { gql } from "@apollo/client";

export const GET_SHARED_ARTIFACTS = gql`
  query GetSharedArtifacts($limit: Int!) {
    shared_artifactsPagination(page: 1, limit: $limit, sort: { field: "createdAt", direction: DESC }) {
      pageInfo {
        itemCount
        pageCount
      }
      items {
        id
        name
        s3key
        auth_mode
        expires_at
        content_type
        rights_mode
        created_by
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_USER_FAVOURITE_ARTIFACTS = gql`
  query GetUserFavouriteArtifacts($id: ID!) {
    userById(id: $id) {
      id
      favourite_artifacts
    }
  }
`;

export const UPDATE_USER_FAVOURITE_ARTIFACTS = gql`
  mutation UpdateUserFavouriteArtifacts($id: Float!, $favourite_artifacts: JSON) {
    usersUpdateOne(input: { favourite_artifacts: $favourite_artifacts }, where: { id: { eq: $id } }) {
      item {
        id
        favourite_artifacts
      }
    }
  }
`;
