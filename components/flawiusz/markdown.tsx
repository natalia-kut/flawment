import type { ReactNode } from "react";
import { humanize } from "./labels";

function inline(text: string) {
  return humanize(text).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).map((part, index) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

type ListItem = { text: string; children: string[] };

// Just enough Markdown for chat replies: paragraphs, headings, lists (one level of
// nesting), bold, italics and code.
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; start: number; items: ListItem[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, index) => (
      <li key={index}>
        {inline(item.text)}
        {item.children.length > 0 && (
          <ul>
            {item.children.map((child, childIndex) => (
              <li key={childIndex}>{inline(child)}</li>
            ))}
          </ul>
        )}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        // Keep the model's numbering when a list is interrupted, instead of restarting at 1.
        <ol key={blocks.length} start={list.start}>{items}</ol>
      ) : (
        <ul key={blocks.length}>{items}</ul>
      ),
    );
    list = null;
  };

  for (const line of text.split("\n")) {
    const item = /^(\s*)(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(line);
    const indented = /^\s{2,}\S/.test(line);
    const lastItem = list?.items.at(-1);

    // Indented lines under a list item belong to that item.
    if (indented && lastItem) {
      lastItem.children.push(item ? item[4] : line.trim());
      continue;
    }
    if (item) {
      const ordered = !item[2];
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, start: ordered ? Number(item[3]) : 1, items: [] };
      list.items.push({ text: item[4], children: [] });
      continue;
    }
    // Blank lines between list items don't end the list; horizontal rules are just noise in a chat.
    if (!line.trim() || /^\s*([-*_])\1{2,}\s*$/.test(line)) continue;
    flushList();
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) blocks.push(<p className="chat-heading" key={blocks.length}>{inline(heading[1])}</p>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flushList();
  return <>{blocks}</>;
}
