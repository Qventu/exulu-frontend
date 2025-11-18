import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";
import prettier from "prettier/standalone";
import * as React from "react";
import { useEffect, useState } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import {
    a11yDark,
    dracula,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("javascript", javascript);

export function CodePreview({
                                className = null,
                                code: inputCode,
                                language,
                                slice = 200,
                            }: {
    className?: string | null;
    code: string;
    language?: string;
    slice?: number | null;
}) {
    const { toast } = useToast();
    const [code, setCode] = useState<string | null>(null);

    const format = async (code, language) => {
        if (typeof code !== "string") {
            code = JSON.stringify(code, null, 2);
        }
        const formattedCode = await prettier.format(code, {
            parser: language,
            plugins: [babel, estree],
        });
        setCode(formattedCode);
    };

    useEffect(() => {
        if (language === "json") {
            format(inputCode, "json");
        } else if (language === "javascript" || language === "js") {
            format(inputCode, "babel");
        } else {
            setCode(inputCode);
        }
    }, [inputCode, language]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                {code?.length && (
                    <SyntaxHighlighter
                        className={cn("cursor-pointer", className)}
                        showLineNumbers={true}
                        wrapLines={true}
                        lineProps={{
                            style: { wordBreak: "break-all", whiteSpace: "pre-wrap" },
                        }}
                        language={language ? language : "plaintext"}
                        style={dracula}
                    >
                        {`${code?.slice(0, slice || 200)} ${code?.length > (slice || 200) ? "..." : ""}`}
                    </SyntaxHighlighter>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] overflow-hidden max-h-[500px] overflow-y-scroll">
                <DialogHeader>
                    <DialogTitle>Code</DialogTitle>
                    <div
                        className="cursor-copy"
                        onClick={async () => {
                            await navigator.clipboard.writeText(code ?? "");
                            toast({ title: "Copied to clipboard" });
                        }}
                    >
                        <SyntaxHighlighter
                            className={cn(className)}
                            showLineNumbers={true}
                            wrapLines={true}
                            lineProps={{
                                style: { wordBreak: "break-all", whiteSpace: "pre-wrap" },
                            }}
                            language={language ? language : "plaintext"}
                            style={dracula}
                        >
                            {code ?? ""}
                        </SyntaxHighlighter>
                    </div>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
