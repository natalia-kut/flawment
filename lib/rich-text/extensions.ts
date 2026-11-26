import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { createMarked, safeHref } from "./markdown";

/** What the editor can do. Underline is left out: Markdown has no way to store it. */
export function richTextExtensions() {
  return [
    StarterKit.configure({
      underline: false,
      heading: { levels: [2, 3] },
      link: {
        openOnClick: false, defaultProtocol: "https", protocols: ["mailto"],
        isAllowedUri: (url, { defaultValidate }) => defaultValidate(url) && (!/^[a-z][a-z0-9+.-]*:/i.test(url) || safeHref(url) !== null),
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // Its own parser, so these rules do not leak into anything else that uses marked.
    Markdown.configure({ marked: createMarked() as never }),
  ];
}

/** The editor keeps an empty line at the end; it is not part of the text. */
export const trimMarkdown = (markdown: string) => markdown.replace(/(?:\s|&nbsp;)+$/, "").replace(/^(?:&nbsp;|\n)+/, "");
