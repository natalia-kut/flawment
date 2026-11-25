"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { richTextExtensions, trimMarkdown } from "@/lib/rich-text/extensions";
import { safeHref } from "@/lib/rich-text/markdown";
import styles from "./rich-text.module.css";

const icon = (children: ReactNode) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;

type Tool = { name: string; keys?: string; icon: ReactNode; active?: (editor: Editor) => boolean; enabled?: (editor: Editor) => boolean; run: (editor: Editor) => void };

const tools: Tool[][] = [
  [
    { name: "Heading", keys: "Ctrl+Alt+2", icon: <b>H1</b>, active: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { name: "Subheading", keys: "Ctrl+Alt+3", icon: <b>H2</b>, active: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { name: "Bold", keys: "Ctrl+B", icon: <b>B</b>, active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { name: "Italic", keys: "Ctrl+I", icon: <i>I</i>, active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { name: "Strikethrough", keys: "Ctrl+Shift+S", icon: <s>S</s>, active: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
    { name: "Inline code", keys: "Ctrl+E", icon: icon(<path d="m8 7-5 5 5 5M16 7l5 5-5 5" />), active: (e) => e.isActive("code"), run: (e) => e.chain().focus().toggleCode().run() },
  ],
  [
    { name: "Bullet list", keys: "Ctrl+Shift+8", icon: icon(<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />), active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { name: "Numbered list", keys: "Ctrl+Shift+7", icon: icon(<path d="M10 6h11M10 12h11M10 18h11M3.5 4.5 5 4v4.5M3.5 14.2c.4-1.4 2.6-1.2 2.4.2-.1.9-1.6 1.6-2.4 3.1h2.6" />), active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { name: "Checklist", keys: "Ctrl+Shift+9", icon: icon(<><rect x="3" y="4" width="7" height="7" rx="1.5" /><path d="m4.8 7.5 1.3 1.3 2.2-2.6M14 7.5h7M14 17h7" /><rect x="3" y="13.5" width="7" height="7" rx="1.5" /></>), active: (e) => e.isActive("taskList"), run: (e) => e.chain().focus().toggleTaskList().run() },
  ],
  [
    { name: "Quote", keys: "Ctrl+Shift+B", icon: icon(<path d="M5 5v14M10 8h10M10 12h10M10 16h6" />), active: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
    { name: "Code block", keys: "Ctrl+Alt+C", icon: icon(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="m9 9.5-2.5 2.5L9 14.5M15 9.5l2.5 2.5-2.5 2.5" /></>), active: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
  ],
];
const history: Tool[] = [
  { name: "Undo", keys: "Ctrl+Z", icon: icon(<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />), enabled: (e) => e.can().undo(), run: (e) => e.chain().focus().undo().run() },
  { name: "Redo", keys: "Ctrl+Shift+Z", icon: icon(<path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />), enabled: (e) => e.can().redo(), run: (e) => e.chain().focus().redo().run() },
];

function ToolButton({ tool, active, enabled = true, onClick }: { tool: Pick<Tool, "name" | "keys" | "icon">; active?: boolean; enabled?: boolean; onClick: () => void }) {
  return <button type="button" className={styles.tool} aria-label={tool.name} aria-pressed={active} disabled={!enabled}
    title={tool.keys ? `${tool.name} (${tool.keys})` : tool.name}
    // Keeps the selection in the text while a button is pressed.
    onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{tool.icon}</button>;
}

/** Comments are short: no headings, and no checklists, which only a task's description can tick. */
const compactTools = tools.slice(1).map((group) => group.filter((tool) => tool.name !== "Checklist"));

function Toolbar({ editor, tools }: { editor: Editor; tools: Tool[][] }) {
  // Re-renders only when one of these changes, not on every keystroke.
  const state = useEditorState({ editor, selector: ({ editor: e }) => ({
    active: tools.map((group) => group.map((tool) => tool.active?.(e) ?? false)),
    enabled: history.map((tool) => tool.enabled?.(e) ?? true),
    link: e.isActive("link"),
  }) });
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
  function applyLink() {
    const typed = linkDraft?.trim() ?? "";
    // "example.com" is what people type; an address with any other scheme is refused.
    const href = !typed ? "" : safeHref(typed) ?? (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(typed) ? null : typed.includes("@") && !typed.includes("/") ? `mailto:${typed}` : `https://${typed}`);
    if (href === null) { setLinkError(true); return; }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) chain.unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive("link")) {
      editor.chain().focus().insertContent({ type: "text", text: typed, marks: [{ type: "link", attrs: { href } }] }).run();
    } else chain.setLink({ href }).run();
    setLinkDraft(null);
  }
  return <div className={styles.toolbar}>
    <div className={styles.tools} role="toolbar" aria-label="Formatting">
      {tools.map((group, g) => <span key={g} className={styles.toolGroup}>
        {group.map((tool, t) => <ToolButton key={tool.name} tool={tool} active={state.active[g][t]} onClick={() => tool.run(editor)} />)}
        {group.some((tool) => tool.name === "Bold") && <ToolButton tool={{ name: "Link", icon: icon(<path d="M10 14a4 4 0 0 0 5.7 0l3.5-3.5a4 4 0 0 0-5.7-5.7L12 6.3M14 10a4 4 0 0 0-5.7 0l-3.5 3.5a4 4 0 0 0 5.7 5.7l1.5-1.5" />) }}
          active={state.link || linkDraft !== null} onClick={() => {
            setLinkError(false);
            setLinkDraft(linkDraft === null ? String(editor.getAttributes("link").href ?? "") : null);
          }} />}
      </span>)}
      <span className={styles.toolGroup}>
        {history.map((tool, index) => <ToolButton key={tool.name} tool={tool} enabled={state.enabled[index]} onClick={() => tool.run(editor)} />)}
      </span>
    </div>
    {linkDraft !== null && <div className={styles.linkRow}>
      {/* A plain text field, so "example.com" passes; it sits inside the page's form, hence the Enter handling. */}
      <input type="text" inputMode="url" aria-label="Link address" aria-invalid={linkError || undefined} placeholder="https://example.com" autoFocus value={linkDraft}
        onChange={(event) => { setLinkDraft(event.target.value); setLinkError(false); }}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); applyLink(); }
          else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setLinkDraft(null); editor.commands.focus(); }
        }} />
      <button type="button" className="text-button" onClick={applyLink}>Apply</button>
      {state.link && <button type="button" className="text-button danger" onClick={() => {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        setLinkDraft(null);
      }}>Remove</button>}
      {linkError && <span className="form-error" role="alert">Use a web or email address.</span>}
    </div>}
  </div>;
}

/** Looks like Markdown someone copied as plain text (from a README or a chat). */
const looksLikeMarkdown = (text: string) => /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>\s|```)/m.test(text) || /\*\*[^*\n]+\*\*/.test(text);

/**
 * Google Docs and Word put a nested list straight inside its parent list, next to the items.
 * Moved into the item before it, the numbering goes on instead of starting again.
 */
function nestPastedLists(html: string) {
  const page = new DOMParser().parseFromString(html, "text/html");
  for (const list of page.querySelectorAll(":is(ol, ul) > :is(ol, ul)")) {
    const item = list.previousElementSibling;
    if (item?.tagName === "LI") item.append(list);
  }
  return page.body.innerHTML;
}

/** The formatting editor. `initial` is read once; every change comes out as Markdown. */
export default function RichTextEditor({ initial, label, placeholder, autoFocus = false, compact = false, onChange, onSubmit, onEscape }: {
  initial: string; label: string; placeholder: string; autoFocus?: boolean; compact?: boolean;
  onChange: (markdown: string) => void;
  /** Ctrl+Enter. */
  onSubmit?: () => void;
  onEscape?: () => void;
}) {
  // The editor is created once, so its handlers reach the latest props through a ref.
  const latest = useRef({ onChange, onSubmit, onEscape });
  useEffect(() => { latest.current = { onChange, onSubmit, onEscape }; });
  const editor = useEditor({
    // Rendered in the browser only: the server shows the read-only text.
    immediatelyRender: false,
    extensions: [...richTextExtensions(), Placeholder.configure({ placeholder })],
    content: initial,
    contentType: "markdown",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: { class: styles.content, role: "textbox", "aria-multiline": "true", "aria-label": label },
      transformPastedHTML: nestPastedLists,
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape" && latest.current.onEscape) { latest.current.onEscape(); return true; }
        if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || !latest.current.onSubmit) return false;
        latest.current.onSubmit();
        return true;
      },
    },
    onUpdate: ({ editor: e }) => latest.current.onChange(trimMarkdown(e.getMarkdown())),
  });
  const className = compact ? `${styles.editor} ${styles.compact}` : styles.editor;
  if (!editor) return <div className={className} aria-busy="true" />;
  return <div className={className}
    onPasteCapture={(event) => {
      const { clipboardData } = event;
      const text = clipboardData.getData("text/plain");
      if (!(event.target as HTMLElement).closest(".ProseMirror") || clipboardData.types.includes("text/html")
        || editor.isActive("codeBlock") || !looksLikeMarkdown(text)) return;
      event.preventDefault(); event.stopPropagation();
      editor.chain().focus().insertContent(text, { contentType: "markdown" }).run();
    }}>
    <Toolbar editor={editor} tools={compact ? compactTools : tools} />
    <EditorContent editor={editor} />
  </div>;
}
