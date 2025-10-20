export type Eval = {
  id: string
  name: string
  description: string
  config: {
    name: string
    description: string
  }[]
  llm: boolean
}