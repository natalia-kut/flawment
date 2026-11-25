import { extensionOf } from "./limits";

export type PreviewKind = "image" | "pdf" | "text" | "table" | "word" | "excel";

const kinds: Partial<Record<string, PreviewKind>> = {
  png: "image", jpg: "image", jpeg: "image", webp: "image", pdf: "pdf", txt: "text", csv: "table", docx: "word", xlsx: "excel",
};

/** How a file can be shown inside the app; null when it can only be downloaded (PowerPoint). */
export function previewKind(name: string): PreviewKind | null {
  return kinds[extensionOf(name) ?? ""] ?? null;
}

export const MAX_PREVIEW_ROWS = 500;
export const MAX_PREVIEW_COLUMNS = 50;
export const MAX_PREVIEW_CHARACTERS = 200_000;

/** UTF-8, or Windows-1250, which Excel saves Polish text in. */
export function decodeText(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

/** The separator used most in the first line, outside quotes: Polish Excel writes semicolons. */
function findSeparator(text: string) {
  const counts = new Map<string, number>([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "\n") break;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

/** The first rows of a CSV file. `more` tells that there are others. */
export function parseCsv(source: string, maxRows = MAX_PREVIEW_ROWS): { rows: string[][]; more: boolean } {
  const text = source.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  const separator = findSeparator(text);
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = false;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === separator) { row.push(cell); cell = ""; }
    else if (char === "\n") {
      rows.push([...row, cell]);
      row = []; cell = "";
      if (rows.length === maxRows) return { rows, more: true };
    } else cell += char;
  }
  if (text) rows.push([...row, cell]);
  return { rows, more: false };
}
