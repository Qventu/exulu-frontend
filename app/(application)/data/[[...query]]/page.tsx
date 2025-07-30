import { DataDisplay } from "@/app/(application)/data/components/data-display";
import * as React from "react";
import ContextsDashboard from "../components/contexts-dashboard";
import { ContextSettings } from "../components/context-settings";

export default async function DataPage({
  params,
}: { params: { query }; }) {

  if (!params.query) {
    return <div className="grow flex flex-col">
      <ContextsDashboard />
    </div>;
  }

  const context = params.query[0] || null;
  const archived = params.query[1] === "archived" || false;
  const settings = params.query[1] === "settings" || false;

  if (settings) {
    return <ContextSettings expand={true} actions={true} context={context} />;
  }

  let item = null;
  if (archived) {
    item = params.query[2] || null;
  } else if (!settings) {
    item = params.query[1] || null;
  }

  return (
    <>
      <DataDisplay
        actions={true}
        contextId={context}
        itemId={item}
      />
    </>
  );
}
