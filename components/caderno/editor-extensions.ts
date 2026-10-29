"use client";

import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/react";
import { dateStampLabel, dateStampTitle } from "@/lib/caderno-shared";

const listItemType = (editor: Editor) => (editor.isActive("taskItem") ? "taskItem" : editor.isActive("listItem") ? "listItem" : null);

/** One level deeper: a list item becomes a subtopic of the one above; plain text starts a list. */
export function indent(editor: Editor) {
  const item = listItemType(editor);
  if (item) return editor.chain().focus().sinkListItem(item).run();
  return editor.chain().focus().toggleBulletList().run();
}

/** One level back: a subtopic returns to the level above, and the first level leaves the list. */
export function outdent(editor: Editor) {
  const item = listItemType(editor);
  return item ? editor.chain().focus().liftListItem(item).run() : false;
}

/** Quotation: inside a list the text first leaves the list, since a list item cannot open with a quote. */
export function toggleQuote(editor: Editor) {
  if (editor.isActive("blockquote") || editor.can().toggleBlockquote()) return editor.chain().focus().toggleBlockquote().run();
  for (let item = listItemType(editor), guard = 0; item && guard < 8; item = listItemType(editor), guard += 1) {
    if (!editor.chain().focus().liftListItem(item).run()) break;
  }
  return editor.chain().focus().toggleBlockquote().run();
}

/**
 * Tab and Shift-Tab change the level of list items (handled by the lists
 * themselves); elsewhere Tab starts a list, and the key never takes the cursor
 * out of the page.
 */
export const IndentKeys = Extension.create({
  name: "indentKeys",
  priority: 50,
  addKeyboardShortcuts() {
    return {
      Tab: () => { indent(this.editor); return true; },
      "Shift-Tab": () => { outdent(this.editor); return true; },
    };
  },
});

/**
 * A little date mark ("29/out") placed in the text, to tell apart what was
 * written on different days about the same subject. It keeps the day itself
 * (YYYY-MM-DD) and is read as "[29/out]" in the plain text and the search.
 */
export const DateStamp = Node.create({
  name: "dateStamp",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { date: { default: null, parseHTML: (element) => element.getAttribute("data-date"), renderHTML: (attributes) => ({ "data-date": attributes.date }) } };
  },
  parseHTML() {
    return [{ tag: "span[data-date-stamp]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const date = String(node.attrs.date ?? "");
    return ["span", mergeAttributes(HTMLAttributes, { "data-date-stamp": "", class: "caderno-date", title: dateStampTitle(date), contenteditable: "false" }), dateStampLabel(date)];
  },
  renderText({ node }) {
    return `[${dateStampLabel(String(node.attrs.date ?? ""))}]`;
  },
});

export function insertDateStamp(editor: Editor, date: string) {
  return editor.chain().focus().insertContent([{ type: "dateStamp", attrs: { date } }, { type: "text", text: " " }]).run();
}
