import { extensionOf, fileTypes, type FileExtension } from "./limits";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const MAX_ENTRIES = 20_000;
/** What a document may unpack to: a preview must not be a way to freeze someone's browser. */
const MAX_UNPACKED = 200 * 1024 * 1024;

/** The names listed in a ZIP's directory, without unpacking anything. Null when it is not a readable ZIP, or unpacks to too much. */
export function zipEntryNames(bytes: Uint8Array): string[] | null {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The directory's own record is at the end, before an optional comment of up to 64 KB.
  let end = bytes.length - 22;
  const earliest = Math.max(0, end - 0xffff);
  while (end >= earliest && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < earliest) return null;
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (count === 0 || count > MAX_ENTRIES) return null;
  const names: string[] = [];
  let unpacked = 0;
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) return null;
    const nameLength = view.getUint16(offset + 28, true);
    const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    unpacked += view.getUint32(offset + 24, true);
    if (next > bytes.length || unpacked > MAX_UNPACKED) return null;
    names.push(decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
    offset = next;
  }
  return names;
}

const officeFolders = { docx: "word/", xlsx: "xl/", pptx: "ppt/" } as const;

function isOffice(bytes: Uint8Array, folder: string) {
  const names = zipEntryNames(bytes);
  return !!names && names.includes("[Content_Types].xml") && names.some((name) => name.startsWith(folder))
    // A macro document renamed to a plain one.
    && !names.some((name) => /vbaProject\.bin$/i.test(name));
}

/** Any text encoding without zero bytes: UTF-8, but also the Windows-1250 that Excel saves CSV in. */
function isText(bytes: Uint8Array) {
  return !bytes.some((byte) => byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0c && byte !== 0x0d) && !bytes.includes(0x7f);
}

const matches: Record<FileExtension, (bytes: Uint8Array) => boolean> = {
  png: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  jpeg: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  webp: (bytes) => startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8),
  pdf: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  docx: (bytes) => isOffice(bytes, officeFolders.docx),
  xlsx: (bytes) => isOffice(bytes, officeFolders.xlsx),
  pptx: (bytes) => isOffice(bytes, officeFolders.pptx),
  txt: isText,
  csv: isText,
};

/** The type of a file whose content is what its name says, otherwise null. */
export function detectType(name: string, bytes: Uint8Array): string | null {
  const extension = extensionOf(name);
  return extension && matches[extension](bytes) ? fileTypes[extension] : null;
}

const MAX_NAME = 150;

/** A name safe to show and to save under: no paths, control characters or text-direction tricks. */
export function cleanFileName(raw: string) {
  const name = raw.normalize("NFC").replace(/^.*[\\/]/, "")
    // Control and invisible formatting characters, including the ones that reverse text.
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .replace(/[<>:"|?*]/g, "_").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return name.slice(0, MAX_NAME);
  const extension = name.slice(dot);
  return Array.from(name.slice(0, dot)).slice(0, MAX_NAME - extension.length).join("").trimEnd() + extension;
}
