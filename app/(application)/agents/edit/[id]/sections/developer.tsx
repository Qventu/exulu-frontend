"use client";

/**
 * Developer section — items 35 (CopyField for agent ID + slug) and a P4 quick
 * start: the full streaming endpoint URL plus copy-pasteable curl / TypeScript
 * snippets that match the real `/agents/{slug}/run/{id}` contract.
 *
 * The legacy model-auth-and-budget block ("Authentication and budget live on
 * the selected model") was removed (2026-06-12 QA decision — unused). The
 * model surface still owns its own auth/budget editing at /models.
 */

import { useTranslations } from "next-intl";
import { useContext } from "react";

import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { CopyField } from "@/components/primitives/copy-field";
import { ConfigContext } from "@/components/shell/config-context";

import type { EditorSectionProps } from "./types";

function buildCurl(endpoint: string): string {
  // Mirrors the live wire payload — disabledTools/approvedTools, the message
  // part array, and a stable client-side session id. Token is a placeholder.
  return `curl '${endpoint}' \\
  -H 'authorization: Bearer YOUR_API_TOKEN' \\
  -H 'content-type: application/json' \\
  -H 'session: YOUR_SESSION_ID' \\
  -H 'stream: true' \\
  -H 'user: YOUR_USER_ID' \\
  --data-raw '${JSON.stringify(
    {
      disabledTools: [],
      approvedTools: [],
      message: {
        parts: [{ type: "text", text: "Hello" }],
        id: "msg_" + Math.random().toString(36).slice(2, 10),
        role: "user",
      },
      id: "req_" + Math.random().toString(36).slice(2, 10),
      session: "YOUR_SESSION_ID",
    },
    null,
    0,
  )}'`;
}

function buildTypescript(endpoint: string): string {
  return `const res = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: \`Bearer \${process.env.EXULU_API_TOKEN}\`,
    session: "YOUR_SESSION_ID",
    user: "YOUR_USER_ID",
    stream: "true",
  },
  body: JSON.stringify({
    disabledTools: [],
    approvedTools: [],
    message: {
      parts: [{ type: "text", text: "Hello" }],
      id: crypto.randomUUID(),
      role: "user",
    },
    id: crypto.randomUUID(),
    session: "YOUR_SESSION_ID",
  }),
});

// The response is a streamed UI-message stream (see the SDK docs).
for await (const chunk of res.body!.pipeThrough(new TextDecoderStream())) {
  console.log(chunk);
}`;
}

export function DeveloperSection({ agent }: EditorSectionProps) {
  const t = useTranslations("agents");
  const config = useContext(ConfigContext);

  const backend = config?.backend?.replace(/\/$/, "") ?? "";
  const slug = agent.slug ?? "";
  const endpoint = `${backend}/agents/${slug}/run/${agent.id}`;
  const slugLine = slug ? `agents/${slug}/run/${agent.id}` : "";

  return (
    <section id="developer" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          {t("editor.sections.developer")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.developer.description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CopyField label={t("editor.developer.idLabel")} value={agent.id} />
        {slug ? (
          <CopyField
            label={t("editor.developer.slugLabel")}
            value={slugLine}
          />
        ) : null}
      </div>

      {slug ? (
        <>
          <CopyField
            label={t("editor.developer.endpointLabel")}
            value={endpoint}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("editor.developer.curlLabel")}
            </p>
            <CodeBlock
              code={buildCurl(endpoint)}
              language="bash"
              className="my-0"
            >
              <CodeBlockCopyButton />
            </CodeBlock>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("editor.developer.tsLabel")}
            </p>
            <CodeBlock
              code={buildTypescript(endpoint)}
              language="typescript"
              className="my-0"
            >
              <CodeBlockCopyButton />
            </CodeBlock>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("editor.developer.noSlugHint")}
        </p>
      )}
    </section>
  );
}
