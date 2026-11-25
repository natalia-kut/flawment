import { Fragment, type ReactNode } from "react";
import type { Token, Tokens } from "marked";
import { decodeEntities, parseMarkdown, safeHref } from "@/lib/rich-text/markdown";
import styles from "./rich-text.module.css";

type Context = { nextTask: number; onToggleTask?: (index: number) => void };

function renderAll(tokens: Token[] | undefined, context: Context): ReactNode {
  return tokens?.map((token, index) => <Fragment key={index}>{render(token, context)}</Fragment>);
}

function renderItem(item: Tokens.ListItem, key: number, context: Context) {
  if (!item.task) return <li key={key}>{renderAll(item.tokens, context)}</li>;
  const index = context.nextTask++;
  const toggle = context.onToggleTask;
  return <li key={key} className={styles.task} data-checked={item.checked}>
    <input type="checkbox" checked={!!item.checked} disabled={!toggle} aria-label={decodeEntities(item.text.split("\n")[0])}
      onChange={() => toggle?.(index)} />
    <div>{renderAll(item.tokens, context)}</div>
  </li>;
}

// Everything becomes a React element, so text can never turn into markup of its own.
function render(token: Token, context: Context): ReactNode {
  const inner = () => renderAll((token as Tokens.Generic).tokens, context);
  switch (token.type) {
    case "space": case "checkbox": return null;
    case "br": return <br />;
    case "hr": return <hr />;
    case "paragraph": return <p>{inner()}</p>;
    case "heading": return (token as Tokens.Heading).depth <= 2 ? <h3 className={styles.large}>{inner()}</h3> : <h4>{inner()}</h4>;
    case "blockquote": return <blockquote>{inner()}</blockquote>;
    case "code": return <pre><code>{token.text}</code></pre>;
    case "strong": return <strong>{inner()}</strong>;
    case "em": return <em>{inner()}</em>;
    case "del": return <s>{inner()}</s>;
    case "codespan": return <code>{token.text}</code>;
    case "link": {
      const href = safeHref(token.href);
      return href ? <a href={href} target="_blank" rel="noopener noreferrer">{inner()}</a> : inner();
    }
    case "list": {
      const list = token as Tokens.List;
      const items = list.items.map((item, index) => renderItem(item, index, context));
      if (list.ordered) return <ol start={Number(list.start) || 1}>{items}</ol>;
      return <ul className={list.items.some((item) => item.task) ? styles.tasks : undefined}>{items}</ul>;
    }
    default:
      return (token as Tokens.Generic).tokens ? inner() : decodeEntities((token as Tokens.Text).text ?? token.raw);
  }
}

/** Formatted text to read. With `onToggleTask`, its checklists can be ticked right there. */
export default function RichText({ text, onToggleTask }: { text: string; onToggleTask?: (index: number) => void }) {
  return <div className={styles.content}>{renderAll(parseMarkdown(text), { nextTask: 0, onToggleTask })}</div>;
}
