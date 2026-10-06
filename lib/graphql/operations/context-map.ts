import { gql } from "@apollo/client";

/**
 * The map's read API (backend sub-project 3c-1/3c-2). Lives in lib/ because
 * both the memory and the knowledge feature render the map widget, and a
 * feature may not import another feature's folder.
 */
export const GET_CONTEXT_MAP_POINTS = gql`
  query ContextMapPoints($contextId: ID!, $mode: ContextMapMode, $groupField: String, $limit: Int) {
    contextMapPoints(contextId: $contextId, mode: $mode, groupField: $groupField, limit: $limit) {
      points { id itemId x y z itemName group chunks createdAtMs }
      total
      sampled
    }
  }
`;

export const GET_CONTEXT_MAP_TOPICS = gql`
  query ContextMapTopics($contextId: ID!) {
    contextMapTopics(contextId: $contextId) { id label count x y z }
  }
`;

export const GET_CONTEXT_MAP_EDGES = gql`
  query ContextMapEdges($contextId: ID!, $nodeId: ID!, $mode: ContextMapMode, $limit: Int) {
    contextMapEdges(contextId: $contextId, nodeId: $nodeId, mode: $mode, limit: $limit) {
      source
      target
      score
    }
  }
`;

export const GET_CONTEXT_PROJECTION_STATUS = gql`
  query ContextProjectionStatus($contextId: ID!) {
    contextProjectionStatus(contextId: $contextId) {
      fitted
      fittedAt
      residual
      mappedChunks
      totalChunks
    }
  }
`;

/**
 * One selected item's metadata. Separate from the points query on purpose: the
 * panel shows this for one item at a time, and the points answer carries up to
 * twenty thousand rows.
 */
export const GET_CONTEXT_MAP_ITEM = gql`
  query ContextMapItem($contextId: ID!, $itemId: ID!) {
    contextMapItem(contextId: $contextId, itemId: $itemId) {
      id
      name
      chunks
      textLength
      source
      createdAt
      updatedAt
    }
  }
`;
