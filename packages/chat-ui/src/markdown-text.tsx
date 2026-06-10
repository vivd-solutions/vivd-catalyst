/// <reference path="./react-syntax-highlighter.d.ts" />

import { MarkdownTextPrimitive, type SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import PrismLight from "react-syntax-highlighter/dist/esm/prism-light";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import remarkGfm from "remark-gfm";

PrismLight.registerLanguage("bash", bash);
PrismLight.registerLanguage("css", css);
PrismLight.registerLanguage("javascript", javascript);
PrismLight.registerLanguage("json", json);
PrismLight.registerLanguage("jsx", jsx);
PrismLight.registerLanguage("markdown", markdown);
PrismLight.registerLanguage("python", python);
PrismLight.registerLanguage("sql", sql);
PrismLight.registerLanguage("tsx", tsx);
PrismLight.registerLanguage("typescript", typescript);
PrismLight.registerLanguage("yaml", yaml);

export function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      className="chat-markdown"
      remarkPlugins={[remarkGfm]}
      components={{
        SyntaxHighlighter,
        CodeHeader: CodeHeader
      }}
    />
  );
}

function SyntaxHighlighter({ components: { Pre, Code }, language, code }: SyntaxHighlighterProps) {
  return (
    <PrismLight
      PreTag={Pre}
      CodeTag={Code}
      customStyle={{
        margin: 0,
        borderRadius: "0 0 0.5rem 0.5rem",
        background: "hsl(0 0% 98%)",
        fontSize: "0.8125rem",
        lineHeight: "1.55"
      }}
      language={language}
      style={oneLight}
      wrapLongLines
    >
      {code}
    </PrismLight>
  );
}

function CodeHeader({ language }: { language: string | undefined }) {
  return (
    <div className="flex min-h-9 items-center justify-between rounded-t-md border border-b-0 bg-muted px-3 text-xs text-muted-foreground">
      <span>{language || "code"}</span>
    </div>
  );
}
