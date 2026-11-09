"use client";

import Image from "next/image";
import { useState } from "react";
import { ChatLog } from "./chat-log";
import { Composer } from "./composer";
import type { FlawiuszChat } from "./use-flawiusz-chat";
import "./flawiusz.css";

// Launcher and slide-in panel, used on every page except the dashboard.
export function FlawiuszPanel({
  chat,
  open,
  onOpenChange,
  onOpenTemplate,
}: {
  chat: FlawiuszChat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTemplate: (templateId: string) => void;
}) {
  const [hintDismissed, setHintDismissed] = useState(false);
  const showHint = !hintDismissed && chat.messages.length === 0;

  return (
    <>
      {!open && (
        <div className="flawiusz-launcher">
          {showHint && (
            <div className="flawiusz-hint">
              <button type="button" className="flawiusz-hint-body" onClick={() => onOpenChange(true)}>
                Need a hand? <strong>Ask Flawiusz</strong>
              </button>
              <button type="button" className="flawiusz-hint-close" aria-label="Dismiss" onClick={() => setHintDismissed(true)}>
                ×
              </button>
            </div>
          )}
          <button type="button" className="flawiusz-fab" aria-label="Chat with Flawiusz" onClick={() => onOpenChange(true)}>
            <Image src="/flawiusz.png" alt="" width={64} height={64} />
            {chat.busy && <span className="flawiusz-fab-dot" aria-hidden="true" />}
          </button>
        </div>
      )}

      <aside
        className={`flawiusz-panel${open ? " open" : ""}`}
        aria-label="Chat with Flawiusz"
        inert={!open}
        onKeyDown={(event) => event.key === "Escape" && onOpenChange(false)}
      >
        <header className="flawiusz-panel-header">
          <Image src="/flawiusz.png" alt="" width={40} height={40} />
          <div>
            <h2>Flawiusz</h2>
            <p>Your project assistant</p>
          </div>
          {chat.messages.length > 0 && (
            <button type="button" className="flawiusz-icon-button" onClick={chat.reset}>
              New chat
            </button>
          )}
          <button
            type="button"
            className="flawiusz-icon-button close"
            aria-label="Close chat"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </header>

        {chat.messages.length === 0 ? (
          <div className="flawiusz-empty">
            <Image src="/flawiusz.png" alt="" width={72} height={72} />
            <p>
              <strong>Hi, I&apos;m Flawiusz!</strong> I can answer questions about your projects, deadlines and team,
              and draft document templates for you.
            </p>
          </div>
        ) : (
          <ChatLog chat={chat} className="in-panel" onOpenTemplate={onOpenTemplate} />
        )}

        <Composer autoFocus={open} chat={chat} placeholder="Ask Flawiusz…" />
      </aside>
    </>
  );
}
