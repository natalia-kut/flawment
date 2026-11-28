import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { largestSheetGrid, MAX_PREVIEW_CELLS } from "../lib/files/sheet-size";

const sheet = (cells: string) => strToU8(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cells}</sheetData></worksheet>`);
const xlsx = (sheets: Record<string, Uint8Array>) => zipSync({ "[Content_Types].xml": strToU8("<Types/>"), ...Object.fromEntries(Object.entries(sheets).map(([name, xml]) => ["xl/worksheets/" + name, xml])) });

test("a spreadsheet's grid is measured from its cell addresses before parsing", () => {
  const small = xlsx({ "sheet1.xml": sheet(`<row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>2</v></c></row><row r="4"><c r="B4"><v>3</v></c></row>`) });
  assert.equal(largestSheetGrid(small), 4 * 3);
  // Three cells, a tiny file, and 14 million cells once parsed.
  const sparse = xlsx({
    "sheet1.xml": sheet(`<row r="1"><c r="A1"><v>1</v></c></row>`),
    "sheet2.xml": sheet(`<row r="1"><c r="A1"/><c r="ZZ1"/></row><row r="20000"><c r="A20000"/></row>`),
  });
  assert.equal(largestSheetGrid(sparse), 20000 * 702);
  assert.ok(largestSheetGrid(sparse) > MAX_PREVIEW_CELLS);
  assert.equal(largestSheetGrid(xlsx({ "sheet1.xml": sheet(`<row r="1048576"><c r="XFD1048576"/></row>`) })), 1048576 * 16384);
  assert.equal(largestSheetGrid(xlsx({})), 0);
});
