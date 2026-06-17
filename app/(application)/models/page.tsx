"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext } from "react";

import { ConfigContext } from "@/components/shell/config-context";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Button } from "@/components/ui/button";
import { getLiteLLMAdminUrl } from "@/lib/litellm-admin-url";

import { LiteLLMCatalogView } from "./components/litellm-catalog-view";

export const dynamic = "force-dynamic";

export default function ModelsPage() {
  const t = useTranslations("models");
  const configContext = useContext(ConfigContext);
  const adminUiUrl = getLiteLLMAdminUrl(configContext?.backend);

  return (
    <PageShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button asChild variant="outline">
            <a href={adminUiUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" className="mr-2 size-4" />
              {t("openAdminUi")}
            </a>
          </Button>
        }
      />
      <LiteLLMCatalogView />
    </PageShell>
  );
}
