"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import type { TaskDetails } from "@/lib/tasks/details";
import { formatSize } from "@/lib/files/limits";
import { decodeText, MAX_PREVIEW_CHARACTERS, MAX_PREVIEW_COLUMNS, MAX_PREVIEW_ROWS, parseCsv, previewKind } from "@/lib/files/preview";
import { useModal } from "@/components/ui/use-modal";
import styles from "./file-preview.module.css";
import { closeOnBackdrop } from "@/components/ui/backdrop";

type TaskFile = TaskDetails["files"][number];
type Sheet = { name: string; rows: string[][]; more: boolean };
type Content =
  | { kind: "pdf"; url: string }
  | { kind: "text"; text: string; more: boolean }
  | { kind: "sheets"; sheets: Sheet[] }
  | { kind: "document"; html: string };

// A document from outside: its frame runs no scripts, loads nothing and cannot reach the app.
const documentPage = (body: string) => `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>
  body { max-width: 46rem; margin: 0 auto; padding: 2rem 1.5rem 3rem; font: 15px/1.6 Calibri, "Segoe UI", sans-serif; color: #211912; background: #fff; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; } h1, h2, h3 { line-height: 1.3; } table { border-collapse: collapse; } td, th { padding: .3rem .6rem; border: 1px solid #d9cabc; vertical-align: top; }
</style><body>${body}`;

function cellText(value: unknown) {
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
  }
  return value === null || value === undefined ? "" : String(value);
}

/** Read in the browser: files are never sent to anyone else to be shown. */
async function load(file: TaskFile, signal: AbortSignal): Promise<Content> {
  const kind = previewKind(file.name);
  if (kind === "pdf" && navigator.pdfViewerEnabled === false) throw new Error("no viewer");
  const response = await fetch(`/api/files/${file.id}`, { signal });
  if (!response.ok) throw new Error("unavailable");
  const data = await response.arrayBuffer();
  switch (kind) {
    case "pdf": return { kind: "pdf", url: URL.createObjectURL(new Blob([data], { type: "application/pdf" })) };
    case "table": {
      const { rows, more } = parseCsv(decodeText(new Uint8Array(data)));
      return { kind: "sheets", sheets: [{ name: file.name, rows, more }] };
    }
    case "excel": {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(data);
      return { kind: "sheets", sheets: sheets.map(({ sheet, data: rows }) => ({
        name: sheet, rows: rows.slice(0, MAX_PREVIEW_ROWS).map((row) => row.map(cellText)), more: rows.length > MAX_PREVIEW_ROWS,
      })) };
    }
    case "word": {
      const { default: mammoth } = await import("mammoth");
      return { kind: "document", html: documentPage((await mammoth.convertToHtml({ arrayBuffer: data })).value) };
    }
    default: {
      const text = decodeText(new Uint8Array(data));
      return { kind: "text", text: text.slice(0, MAX_PREVIEW_CHARACTERS), more: text.length > MAX_PREVIEW_CHARACTERS };
    }
  }
}

function Sheets({ sheets }: { sheets: Sheet[] }) {
  const [selected, setSelected] = useState(0);
  const sheet = sheets[selected];
  if (!sheet || sheet.rows.length === 0) return <p className={styles.message}>This sheet is empty.</p>;
  const columns = Math.max(...sheet.rows.map((row) => row.length));
  return <div className={styles.sheets}>
    {sheets.length > 1 && <div className={styles.tabs} role="group" aria-label="Sheets">
      {sheets.map((item, index) => <button key={index} type="button" aria-pressed={index === selected} onClick={() => setSelected(index)}>{item.name}</button>)}
    </div>}
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={sheet.name}>
      <table className={styles.table}><tbody>
        {sheet.rows.map((row, r) => <tr key={r}>
          <th scope="row">{r + 1}</th>
          {Array.from({ length: Math.min(columns, MAX_PREVIEW_COLUMNS) }, (_, c) => <td key={c}>{row[c] ?? ""}</td>)}
        </tr>)}
      </tbody></table>
    </div>
    {(sheet.more || columns > MAX_PREVIEW_COLUMNS) && <p className={styles.note}>
      Showing the first {sheet.more ? `${MAX_PREVIEW_ROWS} rows` : `${MAX_PREVIEW_COLUMNS} columns`}. Download the file to see all of it.
    </p>}
  </div>;
}

function Preview({ file }: { file: TaskFile }) {
  const isImage = previewKind(file.name) === "image";
  const [content, setContent] = useState<Content | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (isImage) return;
    const controller = new AbortController();
    let url: string | null = null;
    load(file, controller.signal).then((result) => {
      if (result.kind === "pdf") url = result.url;
      if (!controller.signal.aborted) setContent(result);
      else if (url) URL.revokeObjectURL(url);
    }, () => { if (!controller.signal.aborted) setFailed(true); });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  // The file behind an id never changes; a refreshed list must not load it again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, isImage]);

  if (failed) return <p className={styles.message}>This file cannot be shown here. Download it to open it.</p>;
  if (isImage) return <Image className={styles.image} src={`/api/files/${file.id}?view`} alt={file.name} fill unoptimized onError={() => setFailed(true)} />;
  if (!content) return <p className={styles.message} role="status">Loading…</p>;
  switch (content.kind) {
    case "pdf": return <iframe className={styles.frame} src={content.url} title={file.name} />;
    case "document": return <iframe className={styles.frame} srcDoc={content.html} sandbox="" title={file.name} />;
    case "sheets": return <Sheets sheets={content.sheets} />;
    case "text": return <div className={styles.textScroll} tabIndex={0} role="region" aria-label={file.name}>
      <pre className={styles.text}>{content.text}</pre>
      {content.more && <p className={styles.note}>Only the beginning is shown. Download the file to see all of it.</p>}
    </div>;
  }
}

/** A file shown over the page, with the task's other files an arrow away. */
export default function FilePreview({ files, file, onShow, onClose }: {
  /** Those that can be shown. */
  files: TaskFile[]; file: TaskFile; onShow: (id: number) => void; onClose: () => void;
}) {
  const ref = useModal();
  const index = files.findIndex((item) => item.id === file.id);
  const go = (step: number) => {
    const next = files[index + step];
    if (next) onShow(next.id);
  };
  const arrow = (path: ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>;
  return <dialog ref={ref} className={"project-dialog " + styles.dialog} aria-label={file.name} tabIndex={-1}
    onCancel={onClose} {...closeOnBackdrop(onClose)}
    onKeyDown={(event) => {
      // Inside a scrolling table or text the arrows scroll.
      if ((event.target as HTMLElement).getAttribute("role") === "region") return;
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
    }}>
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.title}>
          <h2>{file.name}</h2>
          <p>{formatSize(file.size)} · {`${file.uploader.firstName} ${file.uploader.lastName}`.trim()} · {file.addedOn}</p>
        </div>
        {files.length > 1 && <div className={styles.steps}>
          <button type="button" className="icon-button edit" disabled={index <= 0} aria-label="Previous file" title="Previous file (←)" onClick={() => go(-1)}>{arrow(<path d="m15 5-7 7 7 7" />)}</button>
          <span>{index + 1} / {files.length}</span>
          <button type="button" className="icon-button edit" disabled={index >= files.length - 1} aria-label="Next file" title="Next file (→)" onClick={() => go(1)}>{arrow(<path d="m9 5 7 7-7 7" />)}</button>
        </div>}
        <a className="secondary-button" href={`/api/files/${file.id}`} download={file.name}>Download</a>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close preview">×</button>
      </header>
      <div className={styles.body}><Preview key={file.id} file={file} /></div>
    </div>
  </dialog>;
}
