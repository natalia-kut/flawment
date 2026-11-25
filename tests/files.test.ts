import test from "node:test";
import assert from "node:assert/strict";
import { cleanFileName, detectType, zipEntryNames } from "../lib/files/detect";
import { decodeText, parseCsv, previewKind } from "../lib/files/preview";
import { fileProblem, fileTypes, formatSize, MAX_FILE_BYTES } from "../lib/files/limits";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

/** A ZIP with empty entries: enough for its directory to be read. */
function zip(...names: string[]) {
  const locals: Buffer[] = [], directory: Buffer[] = [];
  let offset = 0;
  for (const name of names) {
    const raw = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(raw.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(raw.length, 28); entry.writeUInt32LE(offset, 42);
    locals.push(local, raw); directory.push(entry, raw);
    offset += 30 + raw.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, ...directory, end]));
}

const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0);
const docx = zip("[Content_Types].xml", "word/document.xml");

test("a file's type comes from its content and must match its name", () => {
  assert.equal(detectType("a.PNG", png), "image/png");
  assert.equal(detectType("a.jpeg", bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(detectType("a.pdf", text("%PDF-1.7")), "application/pdf");
  assert.equal(detectType("a.docx", docx), fileTypes.docx);
  assert.equal(detectType("a.xlsx", zip("[Content_Types].xml", "xl/workbook.xml")), fileTypes.xlsx);
  assert.equal(detectType("a.txt", text("Zażółć\r\n\tgęślą")), "text/plain");
  assert.equal(detectType("a.csv", bytes(0x7a, 0xb3, 0x3b, 0x31)), "text/csv", "Windows-1250 from Excel");

  assert.equal(detectType("a.png", text("<script>")), null);
  assert.equal(detectType("a.pdf", png), null);
  assert.equal(detectType("a.txt", png), null);
  assert.equal(detectType("a.xlsx", docx), null);
  assert.equal(detectType("a.docx", zip("[Content_Types].xml", "word/document.xml", "word/vbaProject.bin")), null, "macros");
  assert.equal(detectType("a.docx", zip("evil.exe")), null);
  for (const name of ["a.svg", "a.html", "a.exe", "a.zip", "a", "a.png.exe", "a.docm", "a.constructor"]) assert.equal(detectType(name, png), null, name);
});

test("damaged archives are refused without failing", () => {
  assert.deepEqual(zipEntryNames(docx), ["[Content_Types].xml", "word/document.xml"]);
  assert.equal(zipEntryNames(png), null);
  for (let length = 0; length < docx.length; length++) assert.doesNotThrow(() => zipEntryNames(docx.subarray(0, length)));
  const bomb = docx.slice();
  new DataView(bomb.buffer).setUint32(30 + "[Content_Types].xml".length + 30 + "word/document.xml".length + 24, 4_000_000_000, true);
  assert.equal(zipEntryNames(bomb), null, "unpacks to 4 GB");
  const badOffset = docx.slice();
  badOffset.fill(0xff, docx.length - 6, docx.length - 2);
  assert.equal(zipEntryNames(badOffset), null);
});

test("file names are cleaned of paths, control characters and tricks", () => {
  assert.equal(cleanFileName("..\\..\\etc/umowa końcowa.pdf"), "umowa końcowa.pdf");
  assert.equal(cleanFileName("a\u202egnp.exe\r\n.png"), "agnp.exe.png");
  assert.equal(cleanFileName("  a \"b\" <c>.pdf "), "a _b_ _c_.pdf");
  assert.equal(cleanFileName("...hidden.txt"), "hidden.txt");
  const long = cleanFileName("ż".repeat(400) + ".docx");
  assert.equal(long.length, 150);
  assert.ok(long.endsWith(".docx"));
});

test("sizes and problems are told in plain words", () => {
  assert.deepEqual([formatSize(900), formatSize(2048), formatSize(MAX_FILE_BYTES)], ["900 B", "2 KB", "10 MB"]);
  assert.equal(fileProblem({ name: "a.pdf", size: MAX_FILE_BYTES }), null);
  assert.match(fileProblem({ name: "a.pdf", size: MAX_FILE_BYTES + 1 })!, /up to 10/);
  assert.match(fileProblem({ name: "a.pdf", size: 0 })!, /empty/);
  assert.match(fileProblem({ name: "a.svg", size: 1 })!, /Choose a/);
});

test("previews read the files people really have", () => {
  assert.deepEqual(["a.PNG", "a.pdf", "a.csv", "a.docx", "a.xlsx", "a.pptx", "a.exe"].map(previewKind), ["image", "pdf", "table", "word", "excel", null, null]);
  assert.equal(decodeText(text("zażółć")), "zażółć");
  assert.equal(decodeText(bytes(0x7a, 0xb3, 0x6f)), "złoto".slice(0, 3), "Windows-1250");
  assert.deepEqual(parseCsv('Name;Cost\r\n"Kowalski; Jan";"1 ""net""\n2"\r\n\r\n').rows, [["Name", "Cost"], ["Kowalski; Jan", '1 "net"\n2']]);
  assert.deepEqual(parseCsv("a,b\n,\n1").rows, [["a", "b"], ["", ""], ["1"]]);
  assert.deepEqual(parseCsv("").rows, []);
  assert.deepEqual(parseCsv("1\n2\n3", 2), { rows: [["1"], ["2"]], more: true });
  assert.deepEqual(parseCsv('"never closed').rows, [["never closed"]]);
});
