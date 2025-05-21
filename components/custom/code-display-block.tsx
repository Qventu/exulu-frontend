"use client";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import React from "react";
import { CodeBlock, dracula, github } from "react-code-blocks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ButtonCodeblockProps {
  code: string;
  lang: string;
  className?: string;
}

export default function CodeDisplayBlock({
  className,
  code,
  lang,
}: ButtonCodeblockProps) {
  const [isCopied, setisCopied] = React.useState(false);
  const { theme } = useTheme();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setisCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => {
      setisCopied(false);
    }, 1500);
  };

  return (
    <div
      className={cn(
        "relative my-4 overflow-scroll overflow-x-scroll  flex flex-col   text-start  ",
        className,
      )}
    >
      <Button
        onClick={copyToClipboard}
        variant="ghost"
        size="icon"
        className="size-5 absolute top-2 right-2"
      >
        {isCopied ? (
          <CheckIcon className="size-4 scale-100 transition-all" />
        ) : (
          <CopyIcon className="size-4 scale-100 transition-all" />
        )}
      </Button>
      <CodeBlock
        customStyle={
          theme === "dark"
            ? { background: "#303033" }
            : { background: "#fcfcfc" }
        }
        text={code}
        language="tsx"
        showLineNumbers={false}
        theme={theme === "dark" ? dracula : github}
      />
    </div>
  );
}
