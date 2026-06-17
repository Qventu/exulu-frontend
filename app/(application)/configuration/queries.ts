import { gql } from "@apollo/client";

/**
 * GraphQL operations for /configuration, colocated per codebase-structure
 * §1.1/§3.2. Copied (and narrowed) from queries/queries.ts — the monolith is
 * untouched; this feature simply stops importing from it. Distinct operation
 * names avoid collisions with the monolith's documents, which other features
 * (image-generation styles share the `platform_configurations` collection)
 * still load.
 *
 * GET_THEME_CONFIGURATION replaces the page's old unfiltered
 * GET_PLATFORM_CONFIGURATIONS fetch (settings-config.md U11): it is the
 * purpose-built by-key query (monolith GET_PLATFORM_CONFIGURATION_BY_KEY,
 * queries.ts:2460) so the page only ever reads the `theme_config` row and can
 * never touch the `image_generation_style:*` rows (inventory #27).
 */

const THEME_CONFIGURATION_FIELDS = `
  id
  config_key
  config_value
  description
  createdAt
  updatedAt
`;

export const GET_THEME_CONFIGURATION = gql`
  query GetThemeConfiguration($config_key: FilterOperatorString!) {
    platform_configurationsPagination(page: 1, limit: 1, filters: { config_key: $config_key }) {
      items {
        ${THEME_CONFIGURATION_FIELDS}
      }
    }
  }
`;

/** Copy of CREATE_PLATFORM_CONFIGURATION — identical root and input type. */
export const CREATE_THEME_CONFIGURATION = gql`
  mutation CreateThemeConfiguration($data: platform_configurationInput!) {
    platform_configurationsCreateOne(input: $data) {
      item {
        ${THEME_CONFIGURATION_FIELDS}
      }
    }
  }
`;

/** Copy of UPDATE_PLATFORM_CONFIGURATION — identical root and input type. */
export const UPDATE_THEME_CONFIGURATION = gql`
  mutation UpdateThemeConfiguration($id: ID!, $data: platform_configurationInput!) {
    platform_configurationsUpdateOneById(id: $id, input: $data) {
      item {
        ${THEME_CONFIGURATION_FIELDS}
      }
    }
  }
`;
