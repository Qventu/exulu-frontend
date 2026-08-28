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

/**
 * Per-case scores, as `job_results` rows.
 *
 * THESE NUMBERS ARE INVENTED. Everything else the tour shows is real Newlift
 * data; this is the one place it is not, and it cannot be otherwise — scoring
 * a case means executing a run against a live model, and the demo has no
 * backend. The questions are real, the suite structure is real, the scoring
 * mechanism is the product's own; the digits are illustrative.
 *
 * They are shaped to show the MECHANISM rather than to claim a result: the
 * earlier run fails one case, the later run passes it, so a visitor sees what
 * a regression looks like and how the average crosses the pass threshold. The
 * chapter's narration deliberately makes no claim about how much any
 * particular change improved accuracy, because nothing here measured that.
 *
 * `label` carries both ids because that is how the product joins a result to a
 * cell: eval-run-column.tsx filters on `label contains "eval-run-<runId>"` and
 * then matches a cell with `label.includes(caseId) && label.includes(runId)`.
 * `result` must be a NUMBER — the average filters on `typeof === "number"`,
 * so a numeric string would render per-case scores and then a blank average.
 */
const scoreRow = (runId: string, caseId: string, score: number, at: string) => ({
  id: `jobresult-${runId}-${caseId}`,
  job_id: `job-${runId}-${caseId}`,
  state: "completed",
  error: null,
  label: `eval-run-${runId}-${caseId}`,
  result: score,
  metadata: null,
  createdAt: at,
  updatedAt: at,
});

const BASELINE_AT = "2026-08-20T09:12:00.000Z";
const NIGHTLY_AT = "2026-08-27T11:04:00.000Z";

export const EVAL_JOB_RESULTS = [
  // The earlier run misses the terminology case badly and lands the set
  // average below the 80 threshold.
  scoreRow("evalrun-2026-08-20", "case-nothalt-cop", 58, BASELINE_AT),
  scoreRow("evalrun-2026-08-20", "case-lsu-reset", 84, BASELINE_AT),
  scoreRow("evalrun-2026-08-20", "case-fst2xt-fahrkurve", 79, BASELINE_AT),

  // The later run passes all three.
  scoreRow("evalrun-2026-08-27", "case-nothalt-cop", 92, NIGHTLY_AT),
  scoreRow("evalrun-2026-08-27", "case-lsu-reset", 88, NIGHTLY_AT),
  scoreRow("evalrun-2026-08-27", "case-fst2xt-fahrkurve", 90, NIGHTLY_AT),
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
