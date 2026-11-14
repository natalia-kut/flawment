"use client";

import { createContext, use, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "./confirm.module.css";

export type ConfirmOptions = {
  title: string;
  /** What happens next, in a sentence. */
  message?: string;
  /** The action's own name: "Delete task", "Remove". */
  confirm: string;
  /** Destructive: the confirm button is red. Defaults to true. */
  danger?: boolean;
};

type Ask = (options: ConfirmOptions) => Promise<boolean>;
type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<Ask | null>(null);

/** Gives everything inside it an in-app confirmation dialog instead of the browser's own. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const ask = useCallback<Ask>((options) => new Promise((resolve) => setRequest({ ...options, resolve })), []);
  function answer(ok: boolean) {
    request?.resolve(ok);
    setRequest(null);
  }
  return <ConfirmContext value={ask}>
    {children}
    {request && <ConfirmDialog request={request} onAnswer={answer} />}
  </ConfirmContext>;
}

function ConfirmDialog({ request, onAnswer }: { request: Request; onAnswer: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const { title, message, confirm, danger = true } = request;
  // Cancel is focused first: these actions cannot be undone, so Enter should not do them.
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="confirm-title" aria-describedby={message ? "confirm-message" : undefined}
    onCancel={(event) => { event.preventDefault(); onAnswer(false); }}
    onClick={(event) => { if (event.target === event.currentTarget) onAnswer(false); }}>
    <div className={styles.body}>
      <span className={styles.icon} data-danger={danger || undefined} aria-hidden="true">{danger ? "!" : "?"}</span>
      <div>
        <h2 id="confirm-title">{title}</h2>
        {message && <p id="confirm-message">{message}</p>}
      </div>
    </div>
    <div className={styles.actions}>
      <button type="button" className="secondary-button" autoFocus onClick={() => onAnswer(false)}>Cancel</button>
      <button type="button" className={danger ? "danger-button" : "primary-button"} onClick={() => onAnswer(true)}>{confirm}</button>
    </div>
  </dialog>;
}

/** Asks for confirmation; resolves true when the person confirms. */
export function useConfirm(): Ask {
  const ask = use(ConfirmContext);
  if (!ask) throw new Error("useConfirm needs a ConfirmProvider above it.");
  return ask;
}

/**
 * For a form that must be confirmed: holds the submit, asks, and submits for real
 * (with the same button) once confirmed.
 */
export function useConfirmSubmit() {
  const ask = useConfirm();
  return (options: ConfirmOptions) => (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    if (form.dataset.confirmed) { delete form.dataset.confirmed; return; }
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    void ask(options).then((ok) => {
      if (!ok) return;
      form.dataset.confirmed = "true";
      form.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined);
    });
  };
}
