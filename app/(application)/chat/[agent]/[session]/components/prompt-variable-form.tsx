import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatVariableName } from "@/lib/prompts/format-variable-name";

interface PromptVariableFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: string[];
  promptName: string;
  onSubmit: (values: Record<string, string>) => void;
}

export function PromptVariableForm({
  open,
  onOpenChange,
  variables,
  promptName,
  onSubmit,
}: PromptVariableFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  // Initialize values when variables change
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    variables.forEach((variable) => {
      initialValues[variable] = "";
    });
    setValues(initialValues);
  }, [variables]);

  const handleValueChange = (variable: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [variable]: value,
    }));
  };

  const handleSubmit = () => {
    onSubmit(values);
    setValues({});
  };

  const allFieldsFilled = variables.every((variable) => values[variable]?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fill in Variables</DialogTitle>
          <DialogDescription>
            Complete the following fields for "{promptName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {variables.map((variable) => (
            <div key={variable} className="space-y-2">
              <Label htmlFor={variable}>{formatVariableName(variable)}</Label>
              <Input
                id={variable}
                placeholder={`Enter ${formatVariableName(variable).toLowerCase()}...`}
                value={values[variable] || ""}
                onChange={(e) => handleValueChange(variable, e.target.value)}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!allFieldsFilled}>
            Insert Prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
