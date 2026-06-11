"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
);

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  preview?: "live" | "edit" | "preview";
  className?: string;
  disabled?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter markdown content...",
  height = 400,
  minHeight,
  maxHeight,
  preview = "live",
  className,
  disabled = false,
}: MarkdownEditorProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Show a simple textarea during SSR/initial render
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full p-3 border rounded-md font-mono text-sm min-h-[400px]"
      />
    );
  }

  return (
    <div className={className} data-color-mode={theme === "dark" ? "dark" : "light"}>
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || "")}
        preview={preview}
        height={height}
        minHeight={minHeight}
        maxHeight={maxHeight}
        textareaProps={{
          placeholder,
          disabled,
        }}
        visibleDragbar={true}
        highlightEnable={true}
        enableScroll={true}
        className="markdown-editor"
      />
    </div>
  );
}
