/**
 * ESLint flat config (ESLint 9).
 *
 * `next lint` was removed in Next.js 16, so `npm run lint` invokes the ESLint
 * CLI directly against this config. It layers the Wave-0 lint guardrails
 * (IMPLEMENTATION_PLAN 0.2, codebase-structure §1.2) on top of
 * eslint-config-next/core-web-vitals:
 *
 *  - tier-boundary import rules (ui → primitives → widgets → shell → features)
 *  - no-console (warn/error allowed)
 *  - no-restricted-globals: confirm / prompt
 *  - ban on `@/util/*` everywhere; ban on the legacy `@/queries/queries`
 *    monolith inside migrated folders
 *  - react/jsx-no-literals scoped to migrated component folders
 *
 * Pre-existing violations live in eslint.tier-exemptions.mjs — that list may
 * only shrink.
 *
 * NOTE on flat-config semantics: when several blocks match a file, the LAST
 * matching block's options for a rule replace earlier ones entirely. Every
 * zone below therefore composes its full `no-restricted-imports` pattern set
 * (global bans + tier bans) instead of relying on merging. A file exempted
 * from its tier zone falls back to the global zone (the `@/util` ban).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";

import {
  tierBoundaryExemptions,
  jsxLiteralExemptions,
} from "./eslint.tier-exemptions.mjs";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

/** Feature folders under app/(application)/ (directories only). */
const features = fs
  .readdirSync(path.join(repoRoot, "app", "(application)"), {
    withFileTypes: true,
  })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Literal repo paths → glob patterns (`[id]` etc. would be char classes). */
const toGlob = (value) => value.replace(/[[\]]/g, "\\$&");
const toGlobs = (values) => values.map(toGlob);

/* -------------------------------------------------------------------------
 * no-restricted-imports pattern sets
 * ---------------------------------------------------------------------- */

/** Global: util/ was dissolved into lib/ in Wave 0. */
const banUtil = {
  group: ["@/util", "@/util/*"],
  message:
    "util/ was dissolved into lib/* in Wave 0 (codebase-structure §4). Import from lib/ instead.",
};

/** Migrated folders must not depend on the legacy GraphQL monolith. */
const banQueriesMonolith = {
  group: ["@/queries/queries"],
  message:
    "Migrated folders must not import the legacy queries/queries.ts monolith (codebase-structure §1.2). Colocate the operation in the feature or lib/graphql.",
};

const banApollo = {
  group: ["@apollo/client", "@apollo/client/*"],
  message: "This tier must stay data-layer free (codebase-structure §1.2).",
};

const banLibApi = {
  group: ["@/lib/api", "@/lib/api/*"],
  message: "This tier must not import lib/api (codebase-structure §1.2).",
};

const banLibGraphql = {
  group: ["@/lib/graphql", "@/lib/graphql/*"],
  message: "This tier must not import lib/graphql (codebase-structure §1.2).",
};

const banQueriesDir = {
  group: ["@/queries", "@/queries/*"],
  message:
    "This tier must not import GraphQL queries (codebase-structure §1.2).",
};

const banAppTypes = {
  group: ["@/types", "@/types/*", "@EXULU_SHARED/*"],
  message: "components/ui must not import app types (codebase-structure §1.2).",
};

const banApp = {
  group: ["@/app", "@/app/*"],
  message: "This tier must not import from app/ (codebase-structure §1.2).",
};

const banTiersAbovePrimitives = {
  group: ["@/components/widgets/*", "@/components/shell/*"],
  message:
    "components/primitives may only use ui + external primitives, never higher tiers (codebase-structure §1.2).",
};

const banAllOtherTiers = {
  group: [
    "@/components/primitives/*",
    "@/components/widgets/*",
    "@/components/shell/*",
  ],
  message:
    "components/ui is the shadcn vendor tier and must not import other tiers (codebase-structure §1.2).",
};

const banShellFromWidgets = {
  group: ["@/components/shell/*"],
  message:
    "components/widgets must not import the shell tier (codebase-structure §1.2).",
};

const crossFeatureMessage = (feature) =>
  `app/(application)/${feature} must not import other features' folders (codebase-structure §1.2). Promote shared code to components/widgets or lib/.`;

/** Alias-form cross-feature ban: `@/app/(application)/<other-feature>/…`. */
const banCrossFeatureAlias = (feature, others) => ({
  regex: `^@/app/\\(application\\)/(?:${others})/`,
  message: crossFeatureMessage(feature),
});

/**
 * Relative-form cross-feature ban. Depth-exact: for a file whose directory
 * sits `depth` levels below the feature root, escaping the feature takes
 * exactly `depth + 1` `../` segments, after which the next segment naming
 * another feature means a cross-feature import. (Fewer `../` stay inside the
 * feature — e.g. users/components → `../data/` is users/data, NOT the data
 * feature.)
 */
const banCrossFeatureRelative = (feature, others, depth) => ({
  regex: `^(?:\\.\\./){${depth + 1}}(?:${others})/`,
  message: crossFeatureMessage(feature),
});

/** Deepest file directory below a feature root (see depth blocks below). */
const MAX_FEATURE_DEPTH = 5;

const restricted = (...patterns) => ["error", { patterns: patterns.flat() }];

/** Config-block helper: omit empty `ignores`. */
const zone = (name, files, ignores, rules) => ({
  name,
  files,
  ...(ignores.length > 0 ? { ignores: toGlobs(ignores) } : {}),
  rules,
});

/* -------------------------------------------------------------------------
 * Config
 * ---------------------------------------------------------------------- */

const config = [
  {
    ignores: [
      "package/**",
      "public/**",
      "design/**",
      "scripts/**",
      "messages/**",
      "*.config.{js,cjs,mjs}",
    ],
  },

  ...nextCoreWebVitals,
  prettier,

  /* ---- Legacy baseline (MAY ONLY SHRINK) ------------------------------
   * Pre-existing eslint-config-next findings in code that predates the
   * guardrails. Phase 0 is behavior-preserving, so instead of mass-editing
   * legacy files these rules are downgraded to "warn" — globally only for
   * the advisory react-hooks v7 compiler rules, per-file for everything
   * else. Each page's Wave-2 redesign fixes its files and removes them
   * here. Never add entries. */
  {
    name: "exulu/legacy-baseline-hooks-advisory",
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      // Cosmetic apostrophe/quote escaping in JSX copy. Hardcoded JSX copy is
      // being removed wholesale by the i18n migration (react/jsx-no-literals
      // per migrated folder), which supersedes this rule; enforcing it would
      // mass-touch ~40 legacy files for zero runtime effect.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    name: "exulu/legacy-baseline-rules-of-hooks",
    files: toGlobs([
      "app/(application)/variables/components/columns.tsx",
      "app/(application)/variables/usage/[variable_id]/page.tsx",
      "app/(application)/workflows/components/columns.tsx",
      "components/ai-elements/response.tsx",
      "components/feedback/feedback-chat.tsx",
      "components/image-generation/image-generation-widget.tsx",
    ]),
    rules: { "react-hooks/rules-of-hooks": "warn" },
  },
  {
    name: "exulu/legacy-baseline-jsx-key",
    files: toGlobs([
      "app/(application)/evals/cases/components/test-case-modal.tsx",
      "components/message-renderer.tsx",
      "components/save-workflow-modal.tsx",
      "components/uppy-dashboard.tsx",
    ]),
    rules: { "react/jsx-key": "warn" },
  },
  {
    name: "exulu/legacy-baseline-html-link",
    files: toGlobs([
      "app/(application)/prompts/[id]/page.tsx",
      "components/shell/navigation.tsx",
    ]),
    rules: { "@next/next/no-html-link-for-pages": "warn" },
  },

  /* ---- Wave-0 guardrails: global ------------------------------------- */
  {
    name: "exulu/guardrails-global",
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-globals": [
        "error",
        {
          name: "confirm",
          message:
            "Use the shared ConfirmDialog primitive instead of the blocking native dialog (codebase-structure §2).",
        },
        {
          name: "prompt",
          message:
            "Use a proper form/dialog instead of the blocking native prompt.",
        },
      ],
      "no-restricted-imports": restricted(banUtil),
    },
  },

  /* ---- Tier boundaries (codebase-structure §1.2) ---------------------- */
  zone(
    "exulu/tier-ui",
    ["components/ui/**"],
    tierBoundaryExemptions["components/ui"],
    {
      "no-restricted-imports": restricted(
        banUtil,
        banApollo,
        banLibApi,
        banLibGraphql,
        banQueriesDir,
        banAppTypes,
        banApp,
        banAllOtherTiers
      ),
    }
  ),
  zone(
    "exulu/tier-primitives",
    ["components/primitives/**"],
    tierBoundaryExemptions["components/primitives"],
    {
      "no-restricted-imports": restricted(
        banUtil,
        banQueriesMonolith,
        banApollo,
        banLibApi,
        banLibGraphql,
        banApp,
        banTiersAbovePrimitives
      ),
    }
  ),
  zone(
    "exulu/tier-widgets",
    ["components/widgets/**"],
    tierBoundaryExemptions["components/widgets"],
    {
      "no-restricted-imports": restricted(
        banUtil,
        banQueriesMonolith,
        banApp,
        banShellFromWidgets
      ),
    }
  ),
  zone(
    "exulu/tier-shell",
    ["components/shell/**"],
    tierBoundaryExemptions["components/shell"],
    {
      "no-restricted-imports": restricted(banUtil, banQueriesMonolith, banApp),
    }
  ),
  zone("exulu/tier-lib", ["lib/**"], tierBoundaryExemptions.lib, {
    "no-restricted-imports": restricted(banUtil, banQueriesMonolith),
  }),

  /* ---- Feature isolation: no cross-feature imports --------------------
   * One alias-only fallback block per feature (covers files nested deeper
   * than MAX_FEATURE_DEPTH), then one depth-exact block per feature×depth
   * so relative `../` climbs out of the feature are caught without
   * false-positives on same-named sibling dirs. Later blocks win. */
  ...features.flatMap((feature) => {
    const others = features
      .filter((name) => name !== feature)
      .map(escapeRegex)
      .join("|");
    const aliasBan = banCrossFeatureAlias(feature, others);
    return [
      zone(
        `exulu/feature-${feature}`,
        [`app/(application)/${feature}/**`],
        tierBoundaryExemptions.features,
        { "no-restricted-imports": restricted(banUtil, aliasBan) }
      ),
      ...Array.from({ length: MAX_FEATURE_DEPTH + 1 }, (_, depth) =>
        zone(
          `exulu/feature-${feature}-depth-${depth}`,
          [`app/(application)/${feature}/${"*/".repeat(depth)}*`],
          tierBoundaryExemptions.features,
          {
            "no-restricted-imports": restricted(
              banUtil,
              aliasBan,
              banCrossFeatureRelative(feature, others, depth)
            ),
          }
        )
      ),
    ];
  }),

  /* ---- i18n exit criterion: no hardcoded copy in migrated folders ----- */
  zone(
    "exulu/jsx-no-literals-migrated",
    [
      "components/primitives/**",
      "components/widgets/**",
      "components/shell/**",
    ],
    jsxLiteralExemptions,
    { "react/jsx-no-literals": "error" }
  ),
];

export default config;
