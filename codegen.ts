import { loadEnvConfig } from '@next/env';
import { CodegenConfig } from '@graphql-codegen/cli';

// Load .env the same way Next.js does so BACKEND / auth vars are available
// when running `npm run graphql-query-typings-compile` outside the Next runtime.
loadEnvConfig(process.cwd());

// The GraphQL endpoint lives on the Exulu backend at `${BACKEND}/graphql`
// (see lib/graphql/server.ts and app/(application)/authenticated.tsx).
// Override the full URL with CODEGEN_SCHEMA_URL when introspecting a
// non-local backend.
const schemaUrl =
    process.env.CODEGEN_SCHEMA_URL ??
    `${process.env.BACKEND ?? 'http://localhost:9001'}/graphql`;

// The backend authenticates every GraphQL request, including introspection.
// Provide ONE of the following before running codegen:
//   CODEGEN_AUTH_TOKEN — a NextAuth JWT (HS256, signed with NEXTAUTH_SECRET)
//                        for an existing user; sent as `Authorization: Bearer`.
//   EXULU_API_KEY      — an Exulu API key (`{key}/{name}`); sent as `exulu-api-key`.
const headers: Record<string, string> = {
    ...(process.env.CODEGEN_AUTH_TOKEN
        ? { Authorization: `Bearer ${process.env.CODEGEN_AUTH_TOKEN}` }
        : {}),
    ...(process.env.EXULU_API_KEY
        ? { 'exulu-api-key': process.env.EXULU_API_KEY }
        : {}),
};

// NOTE (Phase 0 fallback, codebase-structure D6 / Wave 0 item 8): until codegen
// runs against a live, authenticated backend, `types/models/` remains the
// explicitly owned, hand-maintained GraphQL type source. Once generation lands
// under lib/graphql/__generated__/, features migrate to generated types
// per-feature and types/models/ shrinks accordingly.
const config: CodegenConfig = {
    schema: [{ [schemaUrl]: { headers } }],
    documents: [
        // Operations colocate with features (app/<feature>/queries.ts) or live in
        // lib/graphql/operations/ as they migrate out of queries/queries.ts.
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        // The dynamic knowledge-context query factories (GET_ITEMS, UPDATE_ITEM,
        // DELETE_ITEM, ... in queries/queries.ts) build GraphQL documents from
        // runtime strings — they can never be introspected statically and stay
        // hand-typed, permanently excluded from codegen (codebase-structure D6).
        '!queries/**',
        '!lib/graphql/__generated__/**',
    ],
    generates: {
        './lib/graphql/__generated__/': {
            preset: 'client',
            plugins: [],
            presetConfig: {
                gqlTagName: 'gql',
            },
        },
    },
    ignoreNoDocuments: true,
};

export default config;
