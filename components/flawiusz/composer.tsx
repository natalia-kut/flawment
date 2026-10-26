"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { FlawiuszChat } from "./use-flawiusz-chat";
import "./flawiusz.css";

export function Composer({
  chat,
  placeholder,
  autoFocus = false,
}: {
  chat: FlawiuszChat;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submit() {
    if (!draft.trim() || chat.busy) return;
    void chat.send(draft);
    setDraft("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form className="flawiusz-composer" onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        aria-label="Message Flawiusz"
        placeholder={placeholder}
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKey}
      />
      {chat.busy ? (
        <button type="button" className="secondary-button" onClick={chat.stop}>
          Stop
        </button>
      ) : (
        <button type="submit" className="primary-button" disabled={!draft.trim()}>
          Send
        </button>
      )}
    </form>
  );
}
