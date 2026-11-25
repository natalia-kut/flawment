"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import type { TaskDetails } from "@/lib/tasks/details";
import { deleteFileAction } from "@/lib/files/actions";
import { ALLOWED_FILES, extensionOf, fileProblem, fileTypes, formatSize, MAX_FILE_BYTES, MAX_FILES_PER_TASK } from "@/lib/files/limits";
import { previewKind } from "@/lib/files/preview";
import { useConfirm } from "@/components/ui/confirm";
import { BinIcon } from "@/components/ui/icons";
import FilePreview from "./file-preview";
import styles from "./task-files.module.css";

type TaskFile = TaskDetails["files"][number];
type Upload = { key: number; name: string; progress: number; error?: string };

const accept = Object.keys(fileTypes).map((extension) => "." + extension).join(",");

/** XMLHttpRequest rather than fetch: only it reports how much has been sent. */
function send(taskId: number, file: File, name: string, onProgress: (share: number) => void) {
  return new Promise<string | null>((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/tasks/${taskId}/files`);
    request.setRequestHeader("X-File-Name", encodeURIComponent(name));
    request.setRequestHeader("Content-Type", "application/octet-stream");
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onload = () => {
      if (request.status === 201) { resolve(null); return; }
      let message: unknown;
      try { message = JSON.parse(request.responseText).error; } catch { /* Not ours: a generic message below. */ }
      resolve(typeof message === "string" ? message : "Could not add the file. Please try again.");
    };
    request.onerror = () => resolve("Could not add the file. Check your connection and try again.");
    request.send(file);
  });
}

function FileTile({ file, canDelete, onShow }: { file: TaskFile; canDelete: boolean; onShow: () => void }) {
  const ask = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const url = `/api/files/${file.id}`;
  const canShow = previewKind(file.name) !== null;
  async function remove() {
    const ok = await ask({ title: `Delete “${file.name}”?`, message: "The file is removed for everyone. This cannot be undone.", confirm: "Delete file" });
    if (!ok) return;
    setError("");
    start(async () => {
      try {
        const result = await deleteFileAction(file.id);
        if (result.error) setError(result.error);
      } catch {
        setError("Could not delete the file. Please try again.");
      }
    });
  }
  return <li className={styles.file} aria-busy={pending}>
    {/* Opens the preview; a link still, so what cannot be previewed is downloaded. */}
    <a className={styles.open} href={url} download={file.name} title={file.name} aria-haspopup={canShow ? "dialog" : undefined}
      onClick={canShow ? (event) => { event.preventDefault(); onShow(); } : undefined}>
      {file.isImage
        ? <Image className={styles.thumbnail} src={url + "?thumbnail"} alt="" width={240} height={120} unoptimized loading="lazy" />
        : <span className={styles.badge} data-kind={extensionOf(file.name) ?? undefined} aria-hidden="true">{(extensionOf(file.name) ?? "file").toUpperCase()}</span>}
      <span className={styles.name}>{file.name}</span>
    </a>
    <div className={styles.meta}>
      <span>{`${file.uploader.firstName} ${file.uploader.lastName}`.trim()}<br />{formatSize(file.size)} · {file.addedOn}</span>
      <span className={styles.actions}>
        {canShow && <a className="icon-button edit" href={url} download={file.name} aria-label={"Download " + file.name} title="Download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
        </a>}
        {canDelete && <button type="button" className="icon-button" disabled={pending} aria-label={"Delete " + file.name} title="Delete file" onClick={remove}><BinIcon /></button>}
      </span>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </li>;
}

/** A task's files. They can be picked, dropped anywhere on the page, or pasted (a screenshot). */
export default function TaskFiles({ taskId, files, canModerate }: {
  taskId: number; files: TaskFile[];
  /** Whoever runs the project's tasks may remove anyone's file. */
  canModerate: boolean;
}) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  // One after another, so the limit on the number of files is told apart file by file.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const nextKey = useRef(0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dropping, setDropping] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const change = (key: number, values: Partial<Upload>) =>
    setUploads((current) => current.map((upload) => upload.key === key ? { ...upload, ...values } : upload));

  function add(chosen: { file: File; name: string }[]) {
    // What already failed is cleared by the next attempt.
    setUploads((current) => current.filter((upload) => !upload.error));
    for (const { file, name } of chosen) {
      const key = nextKey.current++;
      const problem = fileProblem({ name, size: file.size });
      setUploads((current) => [...current, { key, name, progress: 0, error: problem ?? undefined }]);
      if (problem) continue;
      queue.current = queue.current.then(async () => {
        const error = await send(taskId, file, name, (progress) => change(key, { progress }));
        if (error) change(key, { error });
        else {
          setUploads((current) => current.filter((upload) => upload.key !== key));
          router.refresh();
        }
      });
    }
  }

  const onDrag = useEffectEvent((event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    // Without this a file dropped beside the card would replace the page.
    event.preventDefault();
    if (event.type === "drop") {
      setDropping(false);
      if (!document.querySelector("dialog[open]")) add(Array.from(event.dataTransfer.files, (file) => ({ file, name: file.name })));
    } else setDropping(event.type === "dragover" || event.relatedTarget !== null);
  });
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const data = event.clipboardData;
    // Text copied from a document often brings a picture of itself along: that is still text.
    if (!data?.files.length || data.types.includes("text/plain") || data.types.includes("text/html") || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}.${String(now.getMinutes()).padStart(2, "0")}.${String(now.getSeconds()).padStart(2, "0")}`;
    // The clipboard calls every screenshot "image.png".
    add(Array.from(data.files, (file) => ({ file, name: file.name === "image.png" ? `Screenshot ${stamp}.png` : file.name })));
  });
  useEffect(() => {
    const drag = (event: DragEvent) => onDrag(event);
    const paste = (event: ClipboardEvent) => onPaste(event);
    // Before the text editor, which would swallow both.
    for (const type of ["dragover", "dragleave", "drop"] as const) window.addEventListener(type, drag, true);
    window.addEventListener("paste", paste, true);
    return () => {
      for (const type of ["dragover", "dragleave", "drop"] as const) window.removeEventListener(type, drag, true);
      window.removeEventListener("paste", paste, true);
    };
  }, []);

  const shown = files.filter((file) => previewKind(file.name) !== null);
  const open = shown.find((file) => file.id === openId);
  const full = files.length >= MAX_FILES_PER_TASK;
  return <section className={"workspace-card " + styles.card} data-dropping={dropping || undefined} aria-labelledby="task-files-heading">
    <div className={styles.heading}>
      <h2 id="task-files-heading">Files <span className="role-badge">{files.length}</span></h2>
      <input ref={picker} type="file" multiple hidden accept={accept} aria-label="Choose files" onChange={(event) => {
        add(Array.from(event.target.files ?? [], (file) => ({ file, name: file.name })));
        event.target.value = "";
      }} />
      {!full && <button type="button" className="secondary-button" onClick={() => picker.current?.click()}><span aria-hidden="true">+</span> Add files</button>}
    </div>
    {files.length > 0 && <ul className={styles.files}>
      {files.map((file) => <FileTile key={file.id} file={file} canDelete={file.mine || canModerate} onShow={() => setOpenId(file.id)} />)}
    </ul>}
    {uploads.length > 0 && <ul className={styles.uploads} aria-label="Uploads">
      {uploads.map((upload) => <li key={upload.key} data-failed={!!upload.error || undefined}>
        <span className={styles.uploadName}>{upload.name}</span>
        {upload.error
          ? <>
            <span className="form-error" role="alert">{upload.error}</span>
            <button type="button" className="text-button muted" aria-label={"Dismiss " + upload.name} onClick={() => setUploads((current) => current.filter((item) => item.key !== upload.key))}>Dismiss</button>
          </>
          : <progress value={upload.progress} max={1} aria-label={"Uploading " + upload.name} />}
      </li>)}
    </ul>}
    <p className={styles.hint}>{dropping && !full ? "Drop to add to this task" : full
      ? `This task has all ${MAX_FILES_PER_TASK} files it can hold.`
      : `Drop files here or paste a screenshot. ${ALLOWED_FILES}, up to ${formatSize(MAX_FILE_BYTES)} each.`}</p>
    {open && <FilePreview files={shown} file={open} onShow={setOpenId} onClose={() => setOpenId(null)} />}
  </section>;
}
