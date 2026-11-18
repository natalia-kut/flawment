"use client";

import { useEffect, useRef } from "react";
import { ChatLog } from "./chat-log";
import { Composer } from "./composer";
import type { FlawiuszChat } from "./use-flawiusz-chat";

export function FullChat({ chat, onClose, onOpenTemplate }: {
  chat: FlawiuszChat;
  onClose: () => void;
  onOpenTemplate: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const focused = document.activeElement;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      dialog.close();
      if (focused instanceof HTMLElement && focused.isConnected) focused.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className="flawiusz-full-chat" aria-labelledby="flawiusz-full-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="flawiusz-full-body">
      <header className="flawiusz-full-header">
        <h2 id="flawiusz-full-title">Flawiusz</h2>
        <button type="button" className="secondary-button" onClick={chat.reset} disabled={!chat.messages.length}>New chat</button>
        <button type="button" className="secondary-button" onClick={onClose} autoFocus>Minimize chat</button>
      </header>
      <ChatLog chat={chat} className="in-full-chat" onOpenTemplate={onOpenTemplate} onOpenProject={onClose} />
      <Composer chat={chat} placeholder="Ask Flawiusz…" />
    </div>
  </dialog>;
}
