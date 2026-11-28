import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import Paragraph from "@tiptap/extension-paragraph";
import StarterKit from "@tiptap/starter-kit";
import { createMarked, safeHref } from "./markdown";

/**
 * A line of text that starts like Markdown ("- x", "1. x", "# x", "> x") but is a plain
 * paragraph in the editor: escaped, so it does not come back as a list or a heading.
 */
export function escapeLineStarts(markdown: string) {
  return markdown.replace(/^([ \t]*)([-*+>]|#{1,6}|\d+(?=[.)]))(?=[ \t.)]|$)/gm, (_, indent: string, mark: string) =>
    /^\d/.test(mark) ? indent + mark + "\\" : indent + "\\" + mark);
}

const PlainParagraph = Paragraph.extend({
  renderMarkdown(node, helpers, context) {
    return escapeLineStarts(this.parent?.(node, helpers, context) ?? "");
  },
});

/** What the editor can do. Underline is left out: Markdown has no way to store it. */
export function richTextExtensions() {
  return [
    StarterKit.configure({
      underline: false,
      paragraph: false,
      heading: { levels: [2, 3] },
      link: {
        openOnClick: false, defaultProtocol: "https", protocols: ["mailto"],
        isAllowedUri: (url, { defaultValidate }) => defaultValidate(url) && (!/^[a-z][a-z0-9+.-]*:/i.test(url) || safeHref(url) !== null),
      },
    }),
    PlainParagraph,
    TaskList,
    TaskItem.configure({ nested: true }),
    // Its own parser, so these rules do not leak into anything else that uses marked.
    Markdown.configure({ marked: createMarked() as never }),
  ];
}

/** The editor keeps an empty line at the end; it is not part of the text. */
export const trimMarkdown = (markdown: string) => markdown.replace(/(?:\s|&nbsp;)+$/, "").replace(/^(?:&nbsp;|\n)+/, "");
