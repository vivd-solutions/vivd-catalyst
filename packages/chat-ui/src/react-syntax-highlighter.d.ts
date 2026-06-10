declare module "react-syntax-highlighter/dist/esm/prism-light" {
  import * as React from "react";
  import type { SyntaxHighlighterProps } from "react-syntax-highlighter";

  export default class SyntaxHighlighter extends React.Component<SyntaxHighlighterProps> {
    static registerLanguage(name: string, func: unknown): void;
    static alias(name: string, alias: string | string[]): void;
    static alias(aliases: Record<string, string | string[]>): void;
  }
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/bash" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/css" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/javascript" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/json" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/jsx" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/markdown" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/python" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/sql" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/tsx" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/typescript" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/yaml" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism/one-light" {
  import type { SyntaxHighlighterProps } from "react-syntax-highlighter";

  const style: NonNullable<SyntaxHighlighterProps["style"]>;
  export default style;
}
