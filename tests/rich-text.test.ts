import test from "node:test";
import assert from "node:assert/strict";
import { MarkdownManager } from "@tiptap/markdown";
import { createMarked, plainText, safeHref, toggleTask } from "../lib/rich-text/markdown";
import { escapeLineStarts, richTextExtensions, trimMarkdown } from "../lib/rich-text/extensions";

function editor() {
  return new MarkdownManager({ extensions: richTextExtensions(), marked: createMarked() as never });
}

test("opening and saving a description never loses its text", () => {
  const manager = editor();
  for (const text of [
    "line one\nline two\n\nnext paragraph", "- a\n- b\n  - c\n\n1. x\n2. y", "- [ ] todo\n- [x] done\n  - [ ] nested",
    "**b** *i* ~~s~~ `c` [l](https://x.pl)", "## Head\n\n> quote\n\n```\ncode <b>\n```",
    "List<String> and a < b & c", "<script>alert(1)</script> hi", "2 * 3 * 4, snake_case and ~5 zł",
    "a | b\n--|--\n1 | 2", "![img](https://x/y.png)", "    indented\ntext\n---", "[ref]: https://x.pl", "`a < b` &lt;tag&gt;",
  ]) {
    const saved = trimMarkdown(manager.serialize(manager.parse(text)));
    const squash = (value: string) => plainText(value).replace(/\s+/g, " ");
    assert.equal(squash(saved), squash(text), text);
    assert.equal(trimMarkdown(manager.serialize(manager.parse(saved))), saved, "saving again changes nothing: " + text);
  }
});

test("plain text leaves the formatting out and keeps special characters", () => {
  assert.equal(plainText(null), "");
  assert.equal(plainText("## Scope\n\n- **Review** the [draft](https://x.pl)\n- [x] Sign\n\nList&lt;String&gt; snake\\_case"),
    "Scope\nReview the draft\nSign\nList<String> snake_case");
  assert.equal(plainText("one\r\ntwo"), "one\ntwo");
  assert.equal(plainText("`a &lt; b`"), "a &lt; b", "code is not decoded");
});

test("checklist items are ticked in place", () => {
  const source = "Intro\n\n- [ ] one\n- [x] two\n  - [ ] nested\n\n```\n- [ ] not a task\n```\n\n1. [ ] four";
  assert.equal(toggleTask(source, 0), source.replace("[ ] one", "[x] one"));
  assert.equal(toggleTask(source, 1), source.replace("[x] two", "[ ] two"));
  assert.equal(toggleTask(source, 2), source.replace("[ ] nested", "[x] nested"));
  assert.equal(toggleTask(source, 3), source.replace("[ ] four", "[x] four"));
  assert.equal(toggleTask(source, 4), null);
  assert.equal(toggleTask("no tasks", 0), null);
});

test("only web and email addresses become links", () => {
  assert.equal(safeHref("https://x.pl"), "https://x.pl");
  assert.equal(safeHref("mailto:a@b.pl"), "mailto:a@b.pl");
  for (const href of ["javascript:alert(1)", " javascript:alert(1)", "data:text/html,x", "vbscript:x", "//x.pl", "/x"]) assert.equal(safeHref(href), null, href);
});

test("headings, bold and line starts mean the same in the editor and the reader", () => {
  const manager = editor();
  const save = (text: string) => trimMarkdown(manager.serialize(manager.parse(text)));
  // The editor has two heading levels: others become the nearest one instead of plain text.
  assert.equal(save("# Title"), "## Title");
  assert.equal(save("#### Four"), "### Four");
  // Bold the editor writes against a letter stays bold.
  const bold = manager.parse("foo**(bar)**baz");
  assert.match(JSON.stringify(bold), /"bold"/);
  assert.equal(save("foo**(bar)**baz"), "foo**(bar)**baz");
  assert.equal(plainText("foo**(bar)**baz"), "foo(bar)baz");
  // A paragraph that only looks like a list or a heading is saved so it stays a paragraph.
  for (const line of ["- x", "* x", "+ x", "1. x", "2) x", "# x", "> x"]) {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: line }] }] };
    const saved = trimMarkdown(manager.serialize(doc as never));
    assert.equal(JSON.stringify(manager.parse(saved)).includes('"paragraph"'), true, saved);
    assert.equal(plainText(saved), line, saved);
  }
  assert.equal(escapeLineStarts("-5 degrees\n#tag\n--|--"), "-5 degrees\n#tag\n--|--");
});

