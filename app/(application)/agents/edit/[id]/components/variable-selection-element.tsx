"use client";

/**
 * VariableSelectionElement — extracted verbatim from the legacy form.tsx
 * (lines 106-183). Variable picker with encrypted (🔒) indicator and a
 * "Default value" preview card (item 65 — variable type).
 *
 * Public surface is also re-exported by the editor's MIGRATION-SHIM form.tsx
 * for the one external importer (app/(application)/data/components/
 * embeddings.tsx:44, the knowledge feature — out-of-scope here).
 */

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { TextPreview } from "@/components/custom/text-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface VariableSelectionElementProps {
  configItem: {
    name: string;
    description: string;
    default?: string | boolean | number;
  };
  disabled: boolean;
  currentValue: string | boolean | number;
  variables: any[];
  onVariableSelect: (variableName: string) => void;
}

export function VariableSelectionElement({
  configItem,
  disabled,
  currentValue,
  variables,
  onVariableSelect,
}: VariableSelectionElementProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const selectedVariable = variables.find((v: any) => v.name === currentValue);

  return (
    <div className="space-y-2">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={popoverOpen}
            className="w-full justify-between text-sm"
          >
            {selectedVariable ? selectedVariable.name : "Select variable..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search variables..." />
            <CommandList>
              <CommandEmpty>No variables found.</CommandEmpty>
              <CommandGroup>
                {variables.map((variable: any) => (
                  <CommandItem
                    key={variable.id}
                    onSelect={() => {
                      onVariableSelect(variable.name);
                      setPopoverOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        currentValue === variable.name
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{variable.name}</span>
                      {variable.encrypted && (
                        <span className="text-xs text-muted-foreground">
                          🔒 Encrypted
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
        {configItem.default && (
          <Card>
            <CardHeader>
              <CardTitle className="text-md">Default value</CardTitle>
            </CardHeader>
            <CardContent>
              <TextPreview
                text={configItem.default?.toString() || ""}
                sliceLength={200}
              />
            </CardContent>
          </Card>
        )}
      </Popover>
    </div>
  );
}
