"use client";

import { ChevronDownIcon, Loader2, Shield, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType, ReactNode } from "react";

import { Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClaimCheckClaim, ClaimCheckResult, ClaimCheckSourceType, ClaimVerdict, ScoreLabel } from "@/lib/api/claim-check";

import { summarise } from "./claim-check-data";

/**
 * Claim-check panel state (spec §4-5). Only a finished `"done"` check carries
 * a `result` — `running`/`failed` never pretend to have a score. Imported by
 * name from two later tasks (F4 fires the check and supplies this; a further
 * task rehydrates it from `getSessionClaimChecks`), so the shape here is the
 * contract, not an implementation detail.
 */
export type ClaimCheckState =
  | { status: "running" }
  | { status: "done"; result: ClaimCheckResult }
  | { status: "failed" }
  | null;

/** `score.label` colored with the project's semantic tokens — no new literals. */
const LABEL_TEXT_CLASS: Record<Exclude<ScoreLabel, "n/a">, string> = {
  ok: "text-success",
  warn: "text-warning",
  alert: "text-destructive",
};

const LABEL_ICON: Record<Exclude<ScoreLabel, "n/a">, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  ok: ShieldCheck,
  warn: ShieldAlert,
  alert: ShieldX,
};

/**
 * Verdict badge colour, by the same semantic tokens: `supported` reads as a
 * quiet pass, `contradicted` and `unsupported` are kept visually distinct
 * (destructive vs. warning) because "the sources say otherwise" and "I
 * couldn't find this" are different findings and must never collapse into
 * one colour.
 */
const VERDICT_BADGE_VARIANT: Record<ClaimVerdict, "success" | "destructive" | "warning"> = {
  supported: "success",
  contradicted: "destructive",
  unsupported: "warning",
};

const VERDICT_KEY: Record<ClaimVerdict, "claimCheckVerdictSupported" | "claimCheckVerdictContradicted" | "claimCheckVerdictUnsupported"> = {
  supported: "claimCheckVerdictSupported",
  contradicted: "claimCheckVerdictContradicted",
  unsupported: "claimCheckVerdictUnsupported",
};

/**
 * Every source type the manifest can name, each to its own copy key — the
 * panel must never say "document" for a web page or a recalled memory. A
 * type outside this map (absent, or some value this client does not
 * recognise) has no entry here, which is the signal for the evidence line to
 * fall back to its plain name+quote rendering rather than guess a label.
 */
const SOURCE_TYPE_KEY: Record<
  ClaimCheckSourceType,
  | "claimCheckSourceKnowledgeBase"
  | "claimCheckSourceDocument"
  | "claimCheckSourceMemory"
  | "claimCheckSourceWeb"
  | "claimCheckSourceSessionItem"
  | "claimCheckSourceOther"
> = {
  knowledge_base: "claimCheckSourceKnowledgeBase",
  document: "claimCheckSourceDocument",
  memory: "claimCheckSourceMemory",
  web: "claimCheckSourceWeb",
  session_item: "claimCheckSourceSessionItem",
  other: "claimCheckSourceOther",
};

/**
 * A quiet, non-judgemental line — used for running/failed/no-claims, none of
 * which carry a score.
 *
 * `spin` exists for exactly one caller: the running state's icon is `Loader2`,
 * whose whole job is to turn, and a hardcoded icon class left it sitting
 * still.
 */
function QuietLine({
  icon: Icon,
  spin = false,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  spin?: boolean;
  children: ReactNode;
}) {
  return (
    <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className={cn("size-3.5 shrink-0", spin && "animate-spin")} aria-hidden />
      {children}
    </p>
  );
}

/**
 * The engine's own diagnostics (`result.notes`) — the only place the REASON
 * for an incomplete or empty check is recorded. They were never rendered
 * anywhere, which is what made `label: "n/a"` indistinguishable from an
 * engine failure to a reader (see the n/a branch below).
 *
 * Deliberately presented as engine detail, not product prose: the backend
 * writes them in English and in its own vocabulary ("12 sentence(s) marked
 * not_checked: selection aborted"), so they get a localised heading and a
 * muted, small block rather than being dressed up as a sentence addressed to
 * the reader. Nothing renders when the engine reported none.
 *
 * ONE note is withheld: `claim check failed internally: <err.message>`
 * (`ee/claim-check/run.ts`'s catch-all) carries a raw exception message, which
 * belongs in a log and not in front of whoever reads the answer — this
 * component has no `guestMode` effect, so an external-role user sees the panel
 * too. Nothing is lost by withholding it: the n/a branch's incomplete line
 * already tells the reader the check did not finish, and the full note is on
 * the server and in the stored payload for whoever is debugging. Matched by
 * prefix, since the message itself is arbitrary.
 */
const INTERNAL_FAILURE_NOTE = "claim check failed internally:";

function EngineNotes({ notes, title }: { notes: string[]; title: string }) {
  const shown = notes.filter((note) => !note.startsWith(INTERNAL_FAILURE_NOTE));
  if (shown.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <p className="font-medium">{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
        {shown.map((note, i) => (
          <li key={i}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Checked the answer" panel under an assistant message (spec §5, §5.1).
 * Reuses the `Sources` collapsible `RecalledMemories` uses, so it sits
 * visually beside the existing source badge — collapsed by default, since a
 * real answer can produce dozens of claims and a flat always-open list isn't
 * acceptable (spec §5.1 / task brief).
 *
 * Three things this panel must never get wrong (task brief):
 *  1. `label: "n/a"` is never a 0% score. It also does not always mean "no
 *     checkable claims were made": the backend returns it for an internal
 *     failure and for claims that no usable passage could judge, and those
 *     read as "could not be checked in full" plus the engine's own notes,
 *     never as "there was nothing to check" — which would be a false
 *     statement about the reader's answer.
 *  2. `contradicted` and `unsupported` are different findings and are never
 *     merged into one count or colour.
 *  3. `status: "partial"` means the score covers only part of the answer,
 *     and that warning is shown without opening the panel.
 *
 * Presentational only: a later task (F4) fires the check and supplies
 * `state`; this component never fetches. Two spec §5.1 items are
 * deliberately not delivered here: a live claim counter while running (needs
 * the progressive A2 stream the spec defers — the A1 single-shot endpoint
 * returns once, so there is nothing to count up), and a link from each
 * claim's evidence into the existing source viewer (needs wiring through
 * `components/ai-elements/sources.tsx` and the `/data/<context>/<item>`
 * route; a wrong link is worse than none, so left for a follow-up).
 *
 * `guestMode` is accepted for parity with `RecalledMemories` and because that
 * evidence-link follow-up will need it to suppress a link into the
 * authenticated `/data/...` route. Nothing in this component links anywhere
 * yet, so it currently has no visible effect.
 *
 * Each claim row renders its `evidence[].quote` — the quote is the whole
 * reason a verdict is auditable without the deferred highlighting/link, so a
 * row without it would be an unexplained accusation about the reader's own
 * answer. `sourceNames` (keyed by `evidence[].sourceId`) is optional and
 * supplied by a later task's factory (`collectSources`, Task F2) — when a
 * name is known the quote is attributed to it; when it is not, the quote
 * renders alone. A raw source id is never shown to a reader: it is noise,
 * and worse than no attribution.
 */
export function ClaimCheck(props: {
  state: ClaimCheckState;
  guestMode?: boolean;
  sourceNames?: Record<string, string>;
  sourceTypes?: Record<string, ClaimCheckSourceType>;
}) {
  if (props.state === null) return null;
  // One stable live region around every state this panel can be in.
  //
  // The panel appears SECONDS after the answer finished streaming and then
  // changes again when the result lands — two transitions a screen-reader
  // user gets no cue about otherwise. It has to be one element that OUTLIVES
  // the transition: `aria-live` announces changes INSIDE an existing region,
  // so putting it on each state's own markup would announce nothing (the
  // element itself is what gets replaced). Hence a wrapper that React
  // reconciles across running -> done, rendered only once there is a state
  // at all, so an assistant message with no check adds nothing to the DOM.
  //
  // `aria-atomic="false"` overrides `role="status"`'s implicit `true`, and
  // the claim list carries `aria-live="off"`, so expanding it does not
  // re-read the panel — only the state line changing does.
  return (
    <div role="status" aria-live="polite" aria-atomic="false">
      <ClaimCheckBody {...props} />
    </div>
  );
}

function ClaimCheckBody({
  state,
  guestMode: _guestMode = false,
  sourceNames,
  sourceTypes,
}: {
  state: ClaimCheckState;
  guestMode?: boolean;
  sourceNames?: Record<string, string>;
  sourceTypes?: Record<string, ClaimCheckSourceType>;
}) {
  const t = useTranslations("chat");

  if (state === null) return null;

  if (state.status === "running") {
    return (
      <QuietLine icon={Loader2} spin>
        {t("claimCheckRunning")}
      </QuietLine>
    );
  }

  if (state.status === "failed") {
    return <QuietLine icon={ShieldQuestion}>{t("claimCheckFailed")}</QuietLine>;
  }

  const { result } = state;
  const summary = summarise(result);

  if (summary.label === "n/a") {
    // The backend returns "n/a" for THREE different things: genuinely nothing
    // checkable, an internal failure, and claims that were never judged
    // because no passage was usable (`scoreClaims([])` is reached on the
    // catch-all path too). Only the first means "no checkable statements in
    // this answer" — saying it for the other two tells the reader something
    // false about their own answer, which is the direction of error this
    // feature must never take. `status: "partial"` is what separates them:
    // the engine sets it whenever it gave up on something.
    return (
      <div>
        {summary.partial ? (
          <QuietLine icon={ShieldQuestion}>{t("claimCheckIncomplete")}</QuietLine>
        ) : (
          <QuietLine icon={Shield}>{t("claimCheckNoClaims")}</QuietLine>
        )}
        {/* There is no collapsible here (nothing was scored), so the reason
            goes straight under the line — it is the only thing this panel
            has to say. */}
        <EngineNotes notes={result.notes} title={t("claimCheckNotesTitle")} />
      </div>
    );
  }

  const label = summary.label;
  const Icon = LABEL_ICON[label];

  return (
    <Sources data-demo-id="chat-claim-check">
      {summary.partial && (
        <p className="mb-2 flex items-center gap-2 text-warning">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {t("claimCheckPartial")}
        </p>
      )}
      <SourcesTrigger count={summary.checked} data-claim-check-trigger>
        <Icon className={cn("size-4 shrink-0", LABEL_TEXT_CLASS[label])} aria-hidden />
        <p className={cn("font-medium", LABEL_TEXT_CLASS[label])}>
          {t("claimCheckSummary", { supported: summary.supported, checked: summary.checked })}
        </p>
        {summary.contradicted > 0 && (
          <Badge variant="destructive">{t("claimCheckContradicted", { count: summary.contradicted })}</Badge>
        )}
        {summary.unsupported > 0 && (
          <Badge variant="warning">{t("claimCheckUnsupported", { count: summary.unsupported })}</Badge>
        )}
        <ChevronDownIcon className="h-4 w-4" />
      </SourcesTrigger>
      {/* The expanded list is long and user-initiated: without this it would
          be re-read by the live region every time the reader opens it. */}
      <SourcesContent className="w-full gap-3" aria-live="off">
        <EngineNotes notes={result.notes} title={t("claimCheckNotesTitle")} />
        <ol className="space-y-3">
          {result.claims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} sourceNames={sourceNames} sourceTypes={sourceTypes} t={t} />
          ))}
        </ol>
      </SourcesContent>
    </Sources>
  );
}

function ClaimRow({
  claim,
  sourceNames,
  sourceTypes,
  t,
}: {
  claim: ClaimCheckClaim;
  sourceNames?: Record<string, string>;
  sourceTypes?: Record<string, ClaimCheckSourceType>;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <li className="text-sm text-foreground">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <Badge variant={VERDICT_BADGE_VARIANT[claim.verdict]}>{t(VERDICT_KEY[claim.verdict])}</Badge>
        {claim.inferred && <Badge variant="outline">{t("claimCheckInferred")}</Badge>}
        {claim.rechecked && <Badge variant="outline">{t("claimCheckRechecked")}</Badge>}
      </div>
      <p>{claim.text}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{claim.rationale}</p>
      {claim.evidence.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {claim.evidence.map((evidence, i) => {
            const name = sourceNames?.[evidence.sourceId];
            // A type outside SOURCE_TYPE_KEY (absent, or a value this client
            // does not recognise) renders no label at all — the plain
            // name+quote line the panel has always had — rather than ever
            // showing the raw type string or the raw source id.
            const sourceType = sourceTypes?.[evidence.sourceId];
            const typeKey = sourceType ? SOURCE_TYPE_KEY[sourceType] : undefined;
            const typeLabel = typeKey ? t(typeKey) : undefined;
            return (
              <li key={i} className="text-xs italic text-muted-foreground">
                {/* A dash, not a colon: `claimCheckEvidenceNamed` already
                    reads "{source}: „{quote}“", so a colon here would stack
                    two colons in one line ("Erinnerung: Sprache: „…“") and
                    read as a mistake. The dash and its spacing live in the
                    message files (`claimCheckEvidenceSourceType`, "{label} – ")
                    so a locale can change both — German uses the en dash its
                    own `claimCheckPartial` does, English the em dash. */}
                {typeLabel && (
                  <span className="not-italic font-medium">
                    {t("claimCheckEvidenceSourceType", { label: typeLabel })}
                  </span>
                )}
                {name
                  ? t("claimCheckEvidenceNamed", { source: name, quote: evidence.quote })
                  : t("claimCheckEvidenceQuote", { quote: evidence.quote })}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
