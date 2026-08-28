/**
 * Chapter 5: evals — proving accuracy at scale.
 *
 * The test cases are real questions Newlift engineers asked the production
 * assistant (drawn from positively-rated sessions in staging). The first is
 * chapter 1's own question, so a visitor who arrives here recognises it: the
 * answer they watched being retrieved is also a case in the regression suite.
 *
 * Scores are illustrative rather than measured — the demo has no runs to
 * execute — but the shape is the product's: 0-100 per case, aggregated by the
 * run's scoring_method against its pass_threshold.
 */

const now = "2026-08-27T09:00:00.000Z";

export const EVAL_SETS = [
  {
    id: "evalset-techdoc-regression",
    name: "Technical documentation regression",
    description:
      "Fault codes, parameters and terminal assignments an engineer must get right first time.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "evalset-regulatory",
    name: "Standards & regulations",
    description:
      "Questions answerable only from EN/DIN/VDI sources, to catch answers drifting to product docs.",
    createdAt: now,
    updatedAt: now,
  },
];

/** `inputs` is the scripted multi-turn conversation, stored verbatim. */
const testCase = (
  id: string,
  name: string,
  question: string,
  expected: string,
  knowledgeSources: string[],
) => ({
  id,
  name,
  description: null,
  inputs: [{ role: "user", parts: [{ type: "text", text: question }] }],
  expected_output: expected,
  expected_tools: ["Context_Search"],
  // The product can assert WHICH knowledge base answered, not just the text —
  // the difference between "sounds right" and "came from the right source".
  expected_knowledge_sources: knowledgeSources,
  expected_agent_tools: null,
  eval_set_id: "evalset-techdoc-regression",
  createdAt: now,
  updatedAt: now,
});

export const TEST_CASES = [
  testCase(
    "case-nothalt-cop",
    "Nothalt COP in the FST fault memory",
    'was bedeutet "Nothalt COP" im FST Fehlerspeicher?',
    "Identifies COP as the Car Operating Panel and the entry as the in-car emergency stop being pressed while stationary with doors open. Mentions V0188 naming and Elevision 4.0.",
    ["software_documentation_context", "zendesk_context"],
  ),
  testCase(
    "case-lsu-reset",
    "LSU start-up fault on automatic reset",
    "Kann ich den Fehler LSU-Anfahrproblem auf automatischen Reset stellen?",
    "Explains LSU (Laufzeitüberwachung) and whether automatic reset is permissible for this fault class.",
    ["tech_doc_context"],
  ),
  testCase(
    "case-fst2xt-fahrkurve",
    "FST-2XT parameters affecting the travel curve",
    "Welche Parameter in der FST-2XT beeinflussen die Fahrkurve?",
    "Lists the relevant FST-2XT parameters with their menu paths.",
    ["tech_doc_context"],
  ),
  {
    ...testCase(
      "case-en81-20-inspection",
      "EN 81-20 inspection interval",
      "Welche Prüffristen gelten nach EN 81-20?",
      "Answers from the standards corpus, citing EN 81-20 rather than product documentation.",
      ["vorschriften_context"],
    ),
    eval_set_id: "evalset-regulatory",
  },
];

export const EVAL_RUNS = [
  {
    id: "evalrun-2026-08-27",
    name: "Nightly — gemini-3.1-pro",
    eval_set_id: "evalset-techdoc-regression",
    agent_id: "demo-agent-newton",
    eval_functions: ["llm_as_judge"],
    config: { judge_model: "claude-sonnet-4-6" },
    scoring_method: "AVERAGE",
    pass_threshold: 80,
    test_case_ids: [
      "case-nothalt-cop",
      "case-lsu-reset",
      "case-fst2xt-fahrkurve",
    ],
    createdAt: now,
    updatedAt: now,
    rights_mode: "public",
    RBAC: { type: "eval_run", users: [], roles: [] },
  },
  {
    id: "evalrun-2026-08-20",
    name: "Baseline — before vocabulary tuning",
    eval_set_id: "evalset-techdoc-regression",
    agent_id: "demo-agent-newton",
    eval_functions: ["llm_as_judge"],
    config: { judge_model: "claude-sonnet-4-6" },
    scoring_method: "AVERAGE",
    pass_threshold: 80,
    test_case_ids: [
      "case-nothalt-cop",
      "case-lsu-reset",
      "case-fst2xt-fahrkurve",
    ],
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    rights_mode: "public",
    RBAC: { type: "eval_run", users: [], roles: [] },
  },
];
