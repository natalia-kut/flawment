"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentProps, type MouseEvent } from "react";
import { PencilIcon } from "@/components/ui/icons";
import RichText from "./rich-text";
import styles from "./rich-text.module.css";

// Loaded when someone starts editing, so reading a task stays light.
export const LazyRichTextEditor = dynamic(() => import("./editor"), {
  ssr: false, loading: () => <div className={styles.editor} aria-busy="true" />,
});

/** Text to read that turns into the editor: by the pencil, or by clicking the text itself. */
export function EditableRichText({ text, label, placeholder, onEdit, onToggleTask }: {
  text: string; label: string; placeholder: string; onEdit: () => void; onToggleTask?: (index: number) => void;
}) {
  if (!text) return <button type="button" className={styles.placeholder} onClick={onEdit}>{placeholder}</button>;
  function editOnClick(event: MouseEvent<HTMLElement>) {
    // Following a link, ticking a box or selecting text to copy is not a wish to edit.
    if ((event.target as HTMLElement).closest("a, input, button") || window.getSelection()?.toString()) return;
    onEdit();
  }
  return <div className={styles.readable} onClick={editOnClick}>
    <RichText text={text} onToggleTask={onToggleTask} />
    <button type="button" className={"icon-button edit " + styles.editButton} aria-label={"Edit " + label.toLowerCase()} title={"Edit " + label.toLowerCase()} onClick={onEdit}><PencilIcon /></button>
  </div>;
}

/** A form field with formatting, submitted as Markdown under `name`. */
export default function RichTextField({ name, value, label, placeholder, startEditing = false, onChange, ...editor }: {
  name: string; value: string; label: string; placeholder: string; startEditing?: boolean; onChange: (markdown: string) => void;
} & Pick<ComponentProps<typeof LazyRichTextEditor>, "onSubmit">) {
  const [editing, setEditing] = useState(startEditing);
  return <>
    <input type="hidden" name={name} value={value} />
    {editing
      ? <LazyRichTextEditor initial={value} label={label} placeholder={placeholder} autoFocus={!startEditing} onChange={onChange} {...editor} />
      : <EditableRichText text={value} label={label} placeholder={placeholder} onEdit={() => setEditing(true)} />}
  </>;
}
