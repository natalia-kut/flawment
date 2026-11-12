"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { statusAction, type StatusState } from "@/lib/status/actions";
import { clearAfterOptions, statusPresets, type ClearAfter, type Status } from "@/lib/status/status";

const EMOJIS = ["💬", "🍽️", "☕", "🚗", "📅", "🎯", "🏠", "🤒", "🌴", "✈️", "🎧", "🔕"];

/** Set, change or clear your status: a short note with an emoji that clears itself. */
export default function StatusDialog({ status, onClose }: { status: Status | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [emoji, setEmoji] = useState(status?.emoji ?? "");
  const [text, setText] = useState(status?.text ?? "");
  const [clearAfter, setClearAfter] = useState<ClearAfter>("today");
  const [pickingEmoji, setPickingEmoji] = useState(false);
  const [state, action, pending] = useActionState(async (previous: StatusState, data: FormData) => {
    const result = await statusAction(previous, data);
    if (result.success) onClose();
    return result;
  }, {});

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={ref} className="project-dialog status-dialog" aria-labelledby="status-dialog-title"
    onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="project-dialog-content">
      <div className="project-dialog-heading"><h2 id="status-dialog-title">Set a status</h2><button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">×</button></div>
      <p>Let people know what you are up to right now. It clears itself when you choose.</p>
      <form action={action} className="workspace-form">
        <fieldset disabled={pending}>
          <input type="hidden" name="emoji" value={emoji} />
          <div className="status-input">
            <button type="button" className="status-emoji-button" aria-label={emoji ? `Emoji ${emoji}, change` : "Choose an emoji"} aria-expanded={pickingEmoji}
              onClick={() => setPickingEmoji((p) => !p)}>{emoji || "🙂"}</button>
            <input name="text" maxLength={80} value={text} onChange={(e) => setText(e.target.value)} placeholder="What's your status?" aria-label="Status" autoFocus />
            {(text || emoji) && <button type="button" className="status-input-clear" aria-label="Clear text" onClick={() => { setText(""); setEmoji(""); }}>×</button>}
          </div>
          {pickingEmoji && <div className="emoji-grid" role="group" aria-label="Emoji">
            {EMOJIS.map((e) => <button key={e} type="button" aria-pressed={emoji === e} onClick={() => { setEmoji(e); setPickingEmoji(false); }}>{e}</button>)}
          </div>}

          <div className="status-presets" role="group" aria-label="Suggestions">
            {statusPresets.map((preset) => <button key={preset.text} type="button" className="status-preset"
              onClick={() => { setEmoji(preset.emoji); setText(preset.text); setClearAfter(preset.clearAfter); }}>
              <span aria-hidden="true">{preset.emoji}</span>{preset.text}<small>{clearAfterOptions[preset.clearAfter]}</small>
            </button>)}
          </div>

          <label>Clear after
            <select name="clear_after" value={clearAfter} onChange={(e) => setClearAfter(e.target.value as ClearAfter)}>
              {Object.entries(clearAfterOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          <div className="dialog-actions">
            {status && <button type="submit" name="operation" value="clear" className="secondary-button status-clear-button" formNoValidate>Clear status</button>}
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" name="operation" value="set" className="primary-button" disabled={!text.trim() && !emoji}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </fieldset>
      </form>
    </div>
  </dialog>;
}

/** "🍽️ Lunch · Until 14:00", shown wherever a person appears. */
export function StatusText({ status, withUntil = false }: { status: Status; withUntil?: boolean }) {
  return <span className="status-text" title={status.untilLabel ?? undefined}>
    {status.emoji && <span aria-hidden="true">{status.emoji}</span>}
    <span>{status.text}</span>
    {withUntil && status.untilLabel && <small>· {status.untilLabel}</small>}
  </span>;
}
