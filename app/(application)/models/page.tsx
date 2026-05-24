"use client";

import { useContext } from "react";
import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { LiteLLMCatalogView } from "./components/litellm-catalog-view";
import { UserContext } from "@/app/(application)/authenticated";
import { ConfigContext } from "@/components/config-context";

export const dynamic = "force-dynamic";

export default function ModelsPage() {
  const { user } = useContext(UserContext);
  const configContext = useContext(ConfigContext);
  const litellmEnabled = configContext?.liteLLM?.enabled === true;

  const columns = createColumns(user);

  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Models</h2>
            <p className="text-muted-foreground">
              {litellmEnabled
                ? "LiteLLM is enabled for this instance. Models are configured in LiteLLM directly — this page is a read-only view of LiteLLM's catalog."
                : "Manage the language models available to your agents. Each model pairs a code-defined provider with an encrypted authentication variable and optional rate / budget limits."}
            </p>
          </div>
        </div>
        {litellmEnabled ? (
          <LiteLLMCatalogView />
        ) : (
          <DataTable columns={columns} />
        )}
      </div>
    </>
  );
}
