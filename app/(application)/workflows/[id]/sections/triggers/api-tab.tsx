"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { ConfigContext } from "@/components/shell/config-context";

import type { Routine } from "../../../types";
import { buildRunWorkflowCurl } from "./build-curl";

export interface ApiTriggerTabProps {
  routine: Routine;
}

export function ApiTriggerTab({ routine }: ApiTriggerTabProps) {
  const t = useTranslations("routines");
  const config = React.useContext(ConfigContext);
  const snippet = React.useMemo(
    () => buildRunWorkflowCurl(routine, config?.backend || ""),
    [routine, config],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("triggers.api.description")}
      </p>
      <CodeBlock code={snippet} language="bash">
        <CodeBlockCopyButton />
      </CodeBlock>
      <p className="text-xs text-muted-foreground">
        {t("triggers.api.tokenHint")}{" "}
        <Link href="/token" className="underline underline-offset-2">
          {t("triggers.api.tokenLink")}
        </Link>
      </p>
    </div>
  );
}
