"use client";

import { useState, useTransition } from "react";
import type { TaskDetails } from "@/lib/tasks/details";
import { commentAction } from "@/lib/tasks/actions";
import { MAX_COMMENT_LENGTH } from "@/lib/tasks/limits";
import { useConfirm } from "@/components/ui/confirm";
import { BinIcon, PencilIcon } from "@/components/ui/icons";
import RichText from "@/components/rich-text/rich-text";
import { LazyRichTextEditor } from "@/components/rich-text/rich-text-field";
import UserAvatar from "./user-avatar";
import styles from "./task-page.module.css";

type Thread = TaskDetails["comments"][number];
type Comment = Omit<Thread, "replies">;
export type CommentViewer = { id: number; first_name: string; last_name: string; photoVersion: string | null };

const nameOf = (author: Comment["author"]) => `${author.firstName} ${author.lastName}`.trim();

/** Runs a comment action; `error` holds why it failed. */
function useCommentAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  function run(operation: Parameters<typeof commentAction>[0], fields: Record<string, string | number>, onSuccess?: () => void) {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
    setError("");
    start(async () => {
      try {
        const result = await commentAction(operation, data);
        if (result.error) setError(result.error);
        // In the same transition, so the form closes together with the comment appearing.
        else start(() => onSuccess?.());
      } catch {
        setError("Could not save the comment. Please try again.");
      }
    });
  }
  return { pending, error, run };
}

/** The editor with its buttons; it stays open, text and all, until what it sends is saved. */
function CommentForm({ label, placeholder, note, initial = "", submit, pending, error, onSubmit, onCancel }: {
  label: string; placeholder: string; note?: string; initial?: string; submit: string; pending: boolean; error: string;
  onSubmit: (body: string) => void; onCancel: () => void;
}) {
  const [body, setBody] = useState(initial);
  const tooLong = body.length > MAX_COMMENT_LENGTH;
  const changed = body.trim() !== "" && body.trim() !== initial.trim();
  const ready = changed && !tooLong && !pending;
  const send = () => { if (ready) onSubmit(body.trim()); };
  return <div className={styles.commentForm} inert={pending}>
    {note && <p className={styles.formNote}>{note}</p>}
    <LazyRichTextEditor compact autoFocus initial={initial} label={label} placeholder={placeholder}
      onChange={setBody} onSubmit={send} onEscape={() => { if (body.trim() === initial.trim()) onCancel(); }} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className={styles.formActions}>
      <span className={styles.hint} data-over={tooLong || undefined}>
        {body.length > MAX_COMMENT_LENGTH * .9 ? `${body.length} of ${MAX_COMMENT_LENGTH} characters, formatting included` : "Ctrl + Enter to " + (submit === "Save" ? "save" : "post")}
      </span>
      <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      <button type="button" className="primary-button" disabled={!ready} onClick={send}>{pending ? "Saving…" : submit}</button>
    </div>
  </div>;
}

function CommentItem({ comment, canDelete, onReply }: { comment: Comment; canDelete: boolean; onReply: () => void }) {
  const ask = useConfirm();
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useCommentAction();
  const { author } = comment;
  const name = nameOf(author);
  if (comment.deleted) return <p className={styles.empty}>Comment deleted.</p>;
  async function remove() {
    const ok = await ask({ title: "Delete this comment?", message: "It is removed for everyone. This cannot be undone.", confirm: "Delete comment" });
    if (ok) run("delete", { comment_id: comment.id });
  }
  return <article className={styles.comment} aria-label={"Comment by " + name} aria-busy={pending}>
    <UserAvatar id={author.id ?? 0} firstName={author.firstName} lastName={author.lastName} photoVersion={author.photoVersion} size={comment.isReply ? 30 : 36} />
    <div className={styles.commentBody}>
      <div className={styles.commentHeading}>
        <strong>{name}</strong>
        <time dateTime={comment.postedIso}>{comment.postedAt}</time>
        {comment.editedAt && <span title={"Edited " + comment.editedAt}>· edited</span>}
        {!editing && canDelete && <span className={styles.commentActions}>
          {comment.mine && <button type="button" className="icon-button edit" disabled={pending} aria-label="Edit comment" title="Edit comment" onClick={() => setEditing(true)}><PencilIcon /></button>}
          <button type="button" className="icon-button" disabled={pending} aria-label={"Delete comment by " + name} title="Delete comment" onClick={remove}><BinIcon /></button>
        </span>}
      </div>
      {editing
        ? <CommentForm label="Edit comment" placeholder="Write a comment…" initial={comment.body} submit="Save" pending={pending} error={error}
          onSubmit={(body) => run("edit", { comment_id: comment.id, body }, () => setEditing(false))} onCancel={() => setEditing(false)} />
        : <>
          <RichText text={comment.body} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className={"text-button " + styles.reply} aria-label={"Reply to " + name} onClick={onReply}>Reply</button>
        </>}
    </div>
  </article>;
}

/** A comment with its replies. A reply to a reply joins the same thread. */
function CommentThread({ thread, taskId, canModerate, viewer }: { thread: Thread; taskId: number; canModerate: boolean; viewer: CommentViewer }) {
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const { pending, error, run } = useCommentAction();
  const item = (comment: Comment) => <CommentItem comment={comment} canDelete={comment.mine || canModerate} onReply={() => setReplyTo(comment)} />;
  return <li className={styles.thread}>
    {item(thread)}
    {(thread.replies.length > 0 || replyTo) && <div className={styles.replies}>
      {thread.replies.length > 0 && <ul className={styles.comments} aria-label={thread.deleted ? "Replies" : "Replies to " + nameOf(thread.author)}>
        {thread.replies.map((reply) => <li key={reply.id}>{item(reply)}</li>)}
      </ul>}
      {replyTo && <div className={styles.replyForm}>
        <UserAvatar id={viewer.id} firstName={viewer.first_name} lastName={viewer.last_name} photoVersion={viewer.photoVersion} size={30} />
        {/* Not keyed by whom it answers: picking another comment of the thread keeps what is already written. */}
        <CommentForm label="Write a reply" placeholder="Write a reply…" note={"Replying to " + nameOf(replyTo.author)} submit="Reply" pending={pending} error={error}
          onSubmit={(body) => run("add", { task_id: taskId, parent_id: replyTo.id, body }, () => setReplyTo(null))} onCancel={() => setReplyTo(null)} />
      </div>}
    </div>}
  </li>;
}

/** The discussion on a task: oldest first, with a box to join in at the end. */
export default function TaskComments({ taskId, comments, canModerate, viewer }: {
  taskId: number; comments: Thread[];
  /** Whoever runs the project's tasks may remove anyone's comment. */
  canModerate: boolean;
  viewer: CommentViewer;
}) {
  const { pending, error, run } = useCommentAction();
  const [writing, setWriting] = useState(false);
  const count = comments.reduce((sum, thread) => sum + (thread.deleted ? 0 : 1) + thread.replies.length, 0);
  const placeholder = `Comment as ${viewer.first_name} ${viewer.last_name}…`;
  return <section className="workspace-card" aria-labelledby="task-discussion-heading">
    <h2 id="task-discussion-heading">Discussion <span className="role-badge">{count}</span></h2>
    {comments.length === 0
      ? <p className={styles.empty}>No comments yet. Start the conversation.</p>
      : <ul className={styles.comments}>
        {comments.map((thread) => <CommentThread key={thread.id} thread={thread} taskId={taskId} canModerate={canModerate} viewer={viewer} />)}
      </ul>}
    <div className={styles.composer}>
      <UserAvatar id={viewer.id} firstName={viewer.first_name} lastName={viewer.last_name} photoVersion={viewer.photoVersion} size={36} />
      {writing
        ? <CommentForm label="Write a comment" placeholder={placeholder} submit="Post comment" pending={pending} error={error}
          onSubmit={(body) => run("add", { task_id: taskId, body }, () => setWriting(false))} onCancel={() => setWriting(false)} />
        : <button type="button" className={styles.startComment} onClick={() => setWriting(true)}>{placeholder}</button>}
    </div>
  </section>;
}
