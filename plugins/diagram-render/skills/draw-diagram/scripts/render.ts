#!/usr/bin/env bun
/**
 * Markdown + Mermaid を beautiful-mermaid で SVG に変換し、
 * CSS埋め込みの自己完結 HTML として出力する。
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { parseMermaid, renderMermaidSVG, type RenderOptions } from "beautiful-mermaid";
import { defineCommand, runMain } from "citty";
import { Marked, type Token, type Tokens } from "marked";
import { createHighlighter, type Highlighter } from "shiki";

const HIGHLIGHT_LANGS = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "json",
  "jsonc",
  "bash",
  "shell",
  "fish",
  "zsh",
  "markdown",
  "html",
  "css",
  "scss",
  "yaml",
  "toml",
  "python",
  "go",
  "rust",
  "sql",
  "dockerfile",
  "diff",
  "ini",
  "xml",
] as const;

const LANG_ALIASES: Record<string, string> = {
  sh: "bash",
  shellscript: "bash",
  yml: "yaml",
  md: "markdown",
  py: "python",
  rs: "rust",
  ts: "typescript",
  js: "javascript",
  docker: "dockerfile",
};

function isCodeToken(token: Token): token is Tokens.Code {
  return token.type === "code";
}

let highlighterPromise: Promise<Highlighter> | undefined;
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [...HIGHLIGHT_LANGS],
    });
  }
  return highlighterPromise;
}

function aliasLang(lang: string | undefined): string {
  const raw = (lang ?? "").toLowerCase().trim();
  return LANG_ALIASES[raw] ?? raw;
}

function resolveLang(highlighter: Highlighter, lang: string | undefined): string {
  const aliased = aliasLang(lang);
  if (!aliased) return "text";
  const loaded = new Set<string>(highlighter.getLoadedLanguages());
  return loaded.has(aliased) ? aliased : "text";
}

interface RenderConfig {
  title: string;
  theme: "light" | "dark";
  transparent: boolean;
}

interface MermaidBlock {
  source: string;
  /** 1-indexed line number of the opening ```mermaid fence */
  line: number;
  /** 1-indexed sequential index within the file */
  index: number;
}

interface BlockError {
  block: MermaidBlock;
  message: string;
}

const MERMAID_FENCE = /^```mermaid\s*\n([\s\S]*?)\n```$/gm;

const THEMES: Record<"light" | "dark", RenderOptions> = {
  light: {
    bg: "#FFFFFF",
    fg: "#1F2328",
    surface: "#F6F8FA",
    border: "#D0D7DE",
    line: "#57606A",
    accent: "#0969DA",
    muted: "#656D76",
    font: "Inter, system-ui, sans-serif",
  },
  dark: {
    bg: "#0D1117",
    fg: "#E6EDF3",
    surface: "#161B22",
    border: "#30363D",
    line: "#8B949E",
    accent: "#58A6FF",
    muted: "#8B949E",
    font: "Inter, system-ui, sans-serif",
  },
};

function extractBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  let index = 0;
  for (const match of markdown.matchAll(MERMAID_FENCE)) {
    const source = match[1] ?? "";
    const offset = match.index ?? 0;
    const line = markdown.slice(0, offset).split("\n").length;
    index += 1;
    blocks.push({ source, line, index });
  }
  return blocks;
}

type MermaidGraph = ReturnType<typeof parseMermaid>;

function parseGraph(source: string): MermaidGraph | undefined {
  try {
    return parseMermaid(source);
  } catch (error) {
    // 構文エラーは描画・検査の側で別途報告されるので、孤立ノード検査は飛ばしてよい
    if (process.env.DEBUG) console.error("[debug] detectOrphans: parseMermaid failed:", error);
    return undefined;
  }
}

function connectedIds(graph: MermaidGraph): Set<string> {
  const used = new Set(graph.edges.flatMap((e) => [e.source, e.target]));
  for (const sg of graph.subgraphs) {
    collectSubgraphIds(sg, used);
  }
  return used;
}

function detectOrphans(source: string): string[] {
  const graph = parseGraph(source);
  if (!graph || graph.nodes.size <= 1) return [];
  const used = connectedIds(graph);
  return [...graph.nodes.keys()].filter((id) => !used.has(id));
}

type MermaidSubgraph = ReturnType<typeof parseMermaid>["subgraphs"][number];

function collectSubgraphIds(sg: MermaidSubgraph, used: Set<string>): void {
  // Subgraph itself acts as a connection target; do not treat its container as orphan,
  // but member nodes still need their own edges to count as connected.
  used.add(sg.id);
  for (const child of sg.children) {
    collectSubgraphIds(child, used);
  }
}

function renderBlock(block: MermaidBlock, options: RenderOptions): { svg: string } | BlockError {
  const orphans = detectOrphans(block.source);
  if (orphans.length > 0) {
    return {
      block,
      message: `dangling nodes (no edges): ${orphans.join(", ")}`,
    };
  }
  try {
    const svg = renderMermaidSVG(block.source, options);
    return { svg };
  } catch (error) {
    return {
      block,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function renderMermaidBlocks(
  markdown: string,
  blocks: MermaidBlock[],
  theme: "light" | "dark",
  transparent: boolean,
): { replaced: string; errors: BlockError[] } {
  const options: RenderOptions = { ...THEMES[theme], transparent };
  const errors: BlockError[] = [];
  let cursor = 0;
  let result = "";
  let i = 0;
  for (const match of markdown.matchAll(MERMAID_FENCE)) {
    const matchIndex = match.index ?? 0;
    const block = blocks[i]!;
    i += 1;
    result += markdown.slice(cursor, matchIndex);
    const outcome = renderBlock(block, options);
    if ("svg" in outcome) {
      result += `\n<figure class="mermaid">\n\n${outcome.svg}\n\n</figure>\n`;
    } else {
      errors.push(outcome);
      result += `\n<pre class="mermaid-error">[block #${block.index} line ${block.line}] Mermaid render failed: ${escapeHtml(outcome.message)}\n\n${escapeHtml(block.source)}</pre>\n`;
    }
    cursor = matchIndex + match[0].length;
  }
  result += markdown.slice(cursor);
  return { replaced: result, errors };
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** HTML の配色。GitHub の配色に合わせる */
const PALETTES = {
  dark: {
    colorScheme: "dark",
    bg: "#0D1117",
    fg: "#E6EDF3",
    muted: "#8B949E",
    border: "#30363D",
    codeBg: "#161B22",
    linkColor: "#58A6FF",
  },
  light: {
    colorScheme: "light",
    bg: "#FFFFFF",
    fg: "#1F2328",
    muted: "#656D76",
    border: "#D0D7DE",
    codeBg: "#F6F8FA",
    linkColor: "#0969DA",
  },
} as const;

function wrapHtml(body: string, config: RenderConfig): string {
  const { colorScheme, bg, fg, muted, border, codeBg, linkColor } = PALETTES[config.theme];

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(config.title)}</title>
  <style>
    :root { color-scheme: ${colorScheme}; }
    html, body { margin: 0; padding: 0; background: ${bg}; color: ${fg}; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      font-size: 16px;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 32px 24px 80px;
    }
    h1, h2, h3, h4 { line-height: 1.25; margin-top: 1.6em; margin-bottom: 0.5em; }
    h1 { font-size: 2em; border-bottom: 1px solid ${border}; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid ${border}; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin: 0.8em 0; }
    a { color: ${linkColor}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul, ol { padding-left: 1.6em; }
    li { margin: 0.2em 0; }
    code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.9em;
      background: ${codeBg};
      padding: 0.15em 0.4em;
      border-radius: 4px;
    }
    pre {
      background: ${codeBg};
      border: 1px solid ${border};
      border-radius: 6px;
      padding: 12px 14px;
      overflow-x: auto;
    }
    pre code { background: transparent; padding: 0; }
    blockquote {
      margin: 0.8em 0;
      padding: 0 0.9em;
      color: ${muted};
      border-left: 3px solid ${border};
    }
    table { border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid ${border}; padding: 6px 12px; }
    th { background: ${codeBg}; font-weight: 600; }
    hr { border: 0; border-top: 1px solid ${border}; margin: 2em 0; }
    figure.mermaid {
      margin: 1.5em 0;
      padding: 16px;
      border: 1px solid ${border};
      border-radius: 8px;
      background: ${bg};
      overflow-x: auto;
      text-align: center;
    }
    figure.mermaid svg { max-width: 100%; height: auto; }
    .mermaid-error {
      color: #c00;
      background: ${codeBg};
      border: 1px solid #c00;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <main>
${body}
  </main>
</body>
</html>
`;
}

function reportErrors(inputPath: string, errors: BlockError[]): void {
  for (const e of errors) {
    console.error(`[${inputPath}:${e.block.line}] block #${e.block.index}: ${e.message}`);
  }
}

/**
 * Mermaid ブロックの構文だけを検査する。エラーがあれば exit 1 で終了する
 * @param inputPath 入力 Markdown のパス
 * @param blocks Mermaid ブロック
 */
function validateBlocks(inputPath: string, blocks: MermaidBlock[]): void {
  const options: RenderOptions = { ...THEMES.light };
  const errors = blocks
    .map((block) => renderBlock(block, options))
    .filter((outcome): outcome is BlockError => !("svg" in outcome));
  console.log(
    `Validated: ${inputPath} (${blocks.length - errors.length}/${blocks.length} blocks OK)`,
  );
  if (errors.length > 0) {
    reportErrors(inputPath, errors);
    process.exit(1);
  }
}

function outputPathFor(inputPath: string, output: string | undefined): string {
  return output
    ? resolve(output)
    : resolve(dirname(inputPath), `${basename(inputPath).replace(/\.md$/i, "")}.html`);
}

function plainCodeBlock(text: string): string {
  return `<pre><code>${escapeHtml(text)}</code></pre>`;
}

/**
 * コードブロックを shiki でハイライトする。失敗したらエスケープしただけのコードブロックにする
 * @param highlighter shiki のハイライタ
 * @param token コードブロックのトークン
 * @param shikiTheme shiki のテーマ
 * @returns コードブロックの HTML
 */
function highlightCode(highlighter: Highlighter, token: Tokens.Code, shikiTheme: string): string {
  try {
    return highlighter.codeToHtml(token.text, {
      lang: resolveLang(highlighter, token.lang),
      theme: shikiTheme,
    });
  } catch (error) {
    // ハイライトは見た目の補助なので、失敗したらエスケープしただけのコードブロックで代替してよい
    if (process.env.DEBUG) console.error("[debug] shiki highlight failed:", error);
    return plainCodeBlock(token.text);
  }
}

/**
 * Markdown を HTML にする。コードブロックは shiki でハイライトする
 * @param markdown Mermaid ブロックを SVG に置き換えた Markdown
 * @param theme 配色
 * @returns 本文の HTML
 */
async function markdownToHtml(markdown: string, theme: "light" | "dark"): Promise<string> {
  const highlighter = await getHighlighter();
  const shikiTheme = theme === "dark" ? "github-dark" : "github-light";
  // walkTokens で作ったハイライト済み HTML を、同じトークンを受け取る renderer に渡す
  const highlightedByToken = new WeakMap<Tokens.Code, string>();
  const m = new Marked();
  m.use({
    async: true,
    async walkTokens(token) {
      if (!isCodeToken(token)) return;
      highlightedByToken.set(token, highlightCode(highlighter, token, shikiTheme));
    },
    renderer: {
      code(token: Tokens.Code) {
        return highlightedByToken.get(token) ?? plainCodeBlock(token.text);
      },
    },
  });
  return m.parse(markdown);
}

function themeOf(arg: string): "light" | "dark" {
  return arg === "dark" ? "dark" : "light";
}

/**
 * 出力結果を表示する。--strict でエラーがあれば exit 1 で終了する
 * @param outputPath 出力した HTML のパス
 * @param inputPath 入力 Markdown のパス
 * @param blocks Mermaid ブロック
 * @param errors 描画に失敗したブロック
 * @param strict エラーで失敗させるか
 */
function reportRendered(
  outputPath: string,
  inputPath: string,
  blocks: MermaidBlock[],
  errors: BlockError[],
  strict: boolean,
): void {
  console.log(
    `Rendered: ${outputPath} (${blocks.length - errors.length}/${blocks.length} blocks OK)`,
  );
  if (errors.length === 0) return;
  reportErrors(inputPath, errors);
  if (strict) process.exit(1);
}

const main = defineCommand({
  meta: {
    name: "render",
    description: "Markdown + Mermaid を beautiful-mermaid で SVG 化した自己完結 HTML を出力",
  },
  args: {
    input: {
      type: "positional",
      description: "入力 Markdown ファイルパス",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "出力 HTML パス (省略時は入力と同階層に .html を生成)",
    },
    title: {
      type: "string",
      alias: "t",
      description: "HTML タイトル (省略時はファイル名)",
    },
    theme: {
      type: "string",
      description: "light | dark (default: light)",
      default: "light",
    },
    transparent: {
      type: "boolean",
      description: "Mermaid SVG の背景を透過",
      default: false,
    },
    strict: {
      type: "boolean",
      description: "Mermaid ブロックに 1 つでもエラーがあれば exit 1",
      default: false,
    },
    "validate-only": {
      type: "boolean",
      description: "Mermaid ブロックの構文検査のみ実行し HTML は出力しない (常に exit 1 on error)",
      default: false,
    },
  },
  async run({ args }) {
    const inputPath = resolve(args.input);
    const theme = themeOf(args.theme);
    const markdown = await readFile(inputPath, "utf8");
    const blocks = extractBlocks(markdown);

    if (args["validate-only"]) {
      validateBlocks(inputPath, blocks);
      return;
    }

    const outputPath = outputPathFor(inputPath, args.output);
    const { replaced, errors } = renderMermaidBlocks(markdown, blocks, theme, args.transparent);
    const html = wrapHtml(await markdownToHtml(replaced, theme), {
      title: args.title ?? basename(inputPath),
      theme,
      transparent: args.transparent,
    });
    await writeFile(outputPath, html, "utf8");

    reportRendered(outputPath, inputPath, blocks, errors, args.strict);
  },
});

void runMain(main);
