// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

import type { ExuluFieldTypes } from "@/lib/enums/field-types"
import { allFileTypes } from "./agent"

export interface Context {
  id: string
  name: string
  description: string
  embedder?: {
    model: string,
    queue?: string,
  }
  active: boolean
  slug: string
  configuration: {
    calculateVectors: string
    defaultRightsMode: "private" | "users" | "roles" | "teams" | "public"/*  | "projects" */
  }
  processor: {
    name: string,
    description: string,
    queue: string,
    trigger: string,
    timeoutInSeconds: number,
    generateEmbeddings: boolean
  }
  sources: {
    id
    name
    description
    config: {
      schedule?: string
      queue?: string
      retries?: number
      params?: {
        name: string,
        description: string,
        default: string
      }[]
      backoff?: {
        type: 'exponential' | 'linear'
        delay: number
      }
    }
  }[]
  fields: {
    name: string
    editable?: boolean
    calculated?: boolean
    required?: boolean
    unique?: boolean
    type: ExuluFieldTypes
    label: string
    allowedFileTypes?: allFileTypes[]
    enumValues?: string[]
  }[]
}
