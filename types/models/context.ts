import type { ExuluFieldTypes } from "../enums/field-types"

export interface Context {
    id: string
    name: string
    description: string
    embedder: string
    active: boolean
    slug: string
    configuration: {
        calculateVectors: string
        defaultRightsMode: "private" | "users" | "roles" | "public" | "projects"
    }
    fields: {
      name: string
      type: ExuluFieldTypes
      label: string
    }[]
  }
  