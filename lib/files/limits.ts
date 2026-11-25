/** Shared with the browser, which must not import the sharp-based service. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_TASK = 10;

/** Extension to type. SVG and HTML are left out on purpose: they can carry scripts. */
export const fileTypes = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv",
} as const;
export type FileExtension = keyof typeof fileTypes;

export const ALLOWED_FILES = "PNG, JPEG, WebP, PDF, DOCX, XLSX, PPTX, TXT or CSV";

export function extensionOf(name: string): FileExtension | null {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? "";
  return Object.hasOwn(fileTypes, extension) ? extension as FileExtension : null;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
}

/** Why a file cannot be added, told before it is sent; the server checks again. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!extensionOf(file.name)) return `Choose a ${ALLOWED_FILES} file.`;
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return `A file can have up to ${formatSize(MAX_FILE_BYTES)}.`;
  return null;
}
