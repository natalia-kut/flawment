import { Marked, type Token, type Tokens } from "marked";

/**
 * Formatted text is stored as Markdown. Only what the editor can show is read as formatting:
 * everything else (tables, images, HTML, indented code) stays the plain text it was, because
 * the editor would otherwise drop it on the next save.
 */
export function createMarked() {
  const marked = new Marked({ gfm: true, breaks: true });
  const off = () => undefined;
  marked.use({
    tokenizer: {
      table: off, html: off, tag: off, def: off, reflink: off, lheading: off, code: off,
      // `false` hands over to the standard rule.
      link: (src) => src.startsWith("!") ? undefined : false,
      del: (src) => src.startsWith("~~") ? false : undefined,
    },
  });
  return marked;
}

const reader = createMarked();

export const normalizeNewlines = (text: string) => text.replace(/\r\n?/g, "\n");

export function parseMarkdown(text: string): Token[] {
  return reader.lexer(normalizeNewlines(text));
}

/** The editor writes <, > and & in plain text as entities; code is kept as it is. */
export function decodeEntities(text: string) {
  return text.replace(/&(lt|gt|quot|nbsp|amp);/g, (_, name: string) =>
    ({ lt: "<", gt: ">", quot: '"', nbsp: "\u00a0", amp: "&" })[name]!);
}

const children = (token: Token) => (token as Tokens.Generic).tokens as Token[] | undefined;

function tokenText(token: Token): string {
  switch (token.type) {
    case "space": case "hr": case "checkbox": return "";
    case "br": return "\n";
    case "code": return token.text + "\n";
    case "codespan": return token.text;
    case "list": return (token as Tokens.List).items.map((item) => item.tokens.map(tokenText).join("").trimEnd()).join("\n") + "\n";
    case "paragraph": case "heading": case "blockquote": return (children(token) ?? []).map(tokenText).join("").trimEnd() + "\n";
    default: {
      const nested = children(token);
      if (nested) return nested.map(tokenText).join("") + (token.type === "text" && (token as Tokens.Text).raw.endsWith("\n") ? "\n" : "");
      return decodeEntities((token as Tokens.Text).text ?? token.raw);
    }
  }
}

/** Without the formatting: for searching, one-line summaries and generated documents. */
export function plainText(text: string | null) {
  return text ? parseMarkdown(text).map(tokenText).join("").replace(/\u00a0/g, " ").trim() : "";
}

function countTasks(tokens: Token[]): number {
  return tokens.reduce((sum, token) => {
    const items = token.type === "list" ? (token as Tokens.List).items : null;
    if (items) return sum + items.reduce((count, item) => count + (item.task ? 1 : 0) + countTasks(item.tokens), 0);
    return sum + countTasks(children(token) ?? []);
  }, 0);
}

/** Ticks or unticks the nth checklist item. Null when its place in the text is not certain. */
export function toggleTask(source: string, index: number): string | null {
  const lines = normalizeNewlines(source).split("\n");
  const found: number[] = [];
  let fence: string | null = null;
  lines.forEach((line, number) => {
    const mark = /^\s*(```+|~~~+)/.exec(line)?.[1];
    if (mark && (!fence || mark.startsWith(fence))) fence = fence ? null : mark;
    else if (!fence && /^[\s>]*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s/.test(line)) found.push(number);
  });
  if (index < 0 || index >= found.length || found.length !== countTasks(parseMarkdown(source))) return null;
  lines[found[index]] = lines[found[index]].replace(/\[([ xX])\]/, (_, mark: string) => mark === " " ? "[x]" : "[ ]");
  return lines.join("\n");
}

/** Only addresses that are safe to open; anything else stays plain text. */
export function safeHref(href: string) {
  return /^(https?:\/\/|mailto:)/i.test(href) ? href : null;
}
