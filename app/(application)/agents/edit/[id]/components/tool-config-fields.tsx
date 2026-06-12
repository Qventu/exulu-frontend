"use client";

/**
 * ToolConfigurationElement — extracted from the legacy form.tsx (lines
 * 1541-1653). Item 65 config field types: string (textarea), number (input),
 * boolean (switch), reranker (RerankerSelector — shared read-only), default /
 * variable (VariableSelectionElement).
 */

import * as React from "react";

import { RerankerSelector } from "@/components/reranker-selector";
import { TextPreview } from "@/components/custom/text-preview";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ExuluTool } from "@/types/models/tool";

import { VariableSelectionElement } from "./variable-selection-element";

export type ToolConfigEntry = {
  name: string;
  variable: string | boolean | number;
  type: "string" | "number" | "boolean" | "variable";
};

interface ToolConfigurationElementProps {
  tool: ExuluTool;
  update: (value: any, name: string) => void;
  config: ToolConfigEntry[];
  variables: any[];
}

export function ToolConfigurationElement({
  tool,
  update,
  config,
  variables,
}: ToolConfigurationElementProps) {
  return (
    <>
      {tool.config?.map((configItem, configIndex) => {
        const configEntry = config.find((c) => c.name === configItem.name);
        const currentValue = configEntry?.variable ?? "";

        if (configItem.name === "reranker") {
          return (
            <div
              key={configIndex}
              className="space-y-2 rounded-md border p-3"
            >
              <div className="text-sm font-medium capitalize">
                {configItem.name.replace(/_/g, " ")}
              </div>
              {configItem.description && (
                <TextPreview
                  text={configItem.description}
                  sliceLength={200}
                />
              )}
              <RerankerSelector
                disabled={!configEntry}
                value={currentValue as string}
                onSelect={(value) => update(value, configItem.name)}
              />
            </div>
          );
        }

        switch (configItem.type) {
          case "string":
            return (
              <div
                key={configIndex}
                className="space-y-2 rounded-md border p-3"
              >
                <div className="text-sm font-medium capitalize">
                  {configItem.name.replace(/_/g, " ")}
                </div>
                {configItem.description && (
                  <TextPreview
                    text={configItem.description}
                    sliceLength={200}
                  />
                )}
                <Textarea
                  disabled={!configEntry}
                  value={(currentValue as string) || ""}
                  onChange={(e) => update(e.target.value, configItem.name)}
                />
              </div>
            );
          case "number":
            return (
              <div
                key={configIndex}
                className="space-y-2 rounded-md border p-3"
              >
                <div className="text-sm font-medium capitalize">
                  {configItem.name.replace(/_/g, " ")}
                </div>
                {configItem.description && (
                  <TextPreview
                    text={configItem.description}
                    sliceLength={200}
                  />
                )}
                <Input
                  type="number"
                  disabled={!configEntry}
                  value={currentValue?.toString() || ""}
                  onChange={(e) =>
                    update(Number(e.target.value), configItem.name)
                  }
                />
              </div>
            );
          case "boolean":
            return (
              <div
                key={configIndex}
                className="space-y-2 rounded-md border p-3"
              >
                <div className="text-sm font-medium capitalize">
                  {configItem.name.replace(/_/g, " ")}
                </div>
                {configItem.description && (
                  <TextPreview
                    text={configItem.description}
                    sliceLength={200}
                  />
                )}
                <Switch
                  disabled={!configEntry}
                  checked={
                    currentValue === "true" ||
                    currentValue === true ||
                    currentValue === 1
                  }
                  onCheckedChange={(value) =>
                    update(value ? "true" : "false", configItem.name)
                  }
                />
              </div>
            );
          default:
            return (
              <div
                key={configIndex}
                className="space-y-2 rounded-md border p-3"
              >
                <div className="text-sm font-medium capitalize">
                  {configItem.name.replace(/_/g, " ")}
                </div>
                {configItem.description && (
                  <TextPreview
                    text={configItem.description}
                    sliceLength={200}
                  />
                )}
                <VariableSelectionElement
                  disabled={!configEntry}
                  configItem={configItem}
                  currentValue={currentValue}
                  variables={variables}
                  onVariableSelect={(variableName) =>
                    update(variableName, configItem.name)
                  }
                />
              </div>
            );
        }
      })}
    </>
  );
}
