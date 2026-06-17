export type LiteLLMCatalogEntry = {
  model_name: string;
  upstream_model: string | null;
  tags: string[] | null;
  brand: string | null;
  region: string | null;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  max_tokens: number | null;
  supports_vision: boolean | null;
  supports_function_calling: boolean | null;
  input_cost_per_million_tokens: number | null;
  output_cost_per_million_tokens: number | null;
  active: boolean | null;
  supports_pdf_input: boolean | null;
  supports_audio_input: boolean | null;
};
