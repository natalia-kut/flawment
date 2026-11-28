import { unzipSync } from "fflate";

/**
 * Cells a spreadsheet may span and still be previewed. The preview parser builds every
 * cell of the grid in memory, empty ones included: a tiny file with one cell in A1 and
 * one in XFD1048576 would make billions.
 */
export const MAX_PREVIEW_CELLS = 1_000_000;

/** "A" is 1, "Z" 26, "AA" 27, "XFD" 16384. */
function columnNumber(letters: string) {
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return value;
}

/**
 * The largest grid (rows × columns) that any worksheet of an .xlsx file spans, read from
 * the addresses of its rows and cells before anything is parsed.
 */
export function largestSheetGrid(xlsx: Uint8Array) {
  const sheets = unzipSync(xlsx, { filter: (file) => /^xl\/worksheets\/[^/]+\.xml$/.test(file.name) });
  const decoder = new TextDecoder();
  let largest = 0;
  for (const bytes of Object.values(sheets)) {
    const xml = decoder.decode(bytes);
    let rows = 0, columns = 0;
    for (const [, row] of xml.matchAll(/<(?:\w+:)?row\b[^>]*?\sr="(\d+)"/g)) rows = Math.max(rows, Number(row));
    for (const [, column, row] of xml.matchAll(/<(?:\w+:)?c\b[^>]*?\sr="([A-Z]{1,3})(\d+)"/g)) {
      columns = Math.max(columns, columnNumber(column));
      rows = Math.max(rows, Number(row));
    }
    largest = Math.max(largest, rows * columns);
  }
  return largest;
}
