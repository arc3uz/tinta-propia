import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  rectangularSelection,
  crosshairCursor,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: "#12355b", fontWeight: "700" },
  { tag: tags.heading2, color: "#17365d", fontWeight: "700" },
  { tag: tags.heading3, color: "#1d4a7a", fontWeight: "700" },
  { tag: tags.heading4, color: "#1d4a7a", fontWeight: "600" },
  { tag: tags.heading5, color: "#2b5d8c", fontWeight: "600" },
  { tag: tags.heading6, color: "#2b5d8c", fontWeight: "600" },
  { tag: tags.strong, color: "#0f172a", fontWeight: "700" },
  { tag: tags.emphasis, color: "#1f2937", fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#8b95a5" },
  { tag: tags.link, color: "#0b66c3", textDecoration: "underline" },
  { tag: tags.url, color: "#0b66c3", textDecoration: "underline" },
  { tag: tags.monospace, color: "#a52a2a", background: "rgba(165,42,42,.055)" },
  { tag: tags.quote, color: "#607086" },
  { tag: tags.list, color: "#12355b" },
  { tag: tags.meta, color: "#98a2b3" },
  { tag: tags.contentSeparator, color: "#c3cbd6" },
  { tag: tags.comment, color: "#7c8798", fontStyle: "italic" },
  { tag: tags.keyword, color: "#9a3412" },
  { tag: tags.string, color: "#2e6b4f" },
  { tag: tags.number, color: "#8a4b08" },
]);

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#ffffff",
    color: "#1f2937",
    fontSize: "13.5px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily:
      '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    lineHeight: "1.72",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "20px 0 42vh",
    caretColor: "#1f9d55",
  },
  ".cm-line": { padding: "0 34px 0 14px" },
  ".cm-gutters": {
    backgroundColor: "#fafbfc",
    color: "#a0a9b5",
    border: "none",
    borderRight: "1px solid #eef1f5",
    paddingLeft: "4px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 10px 0 8px",
    minWidth: "38px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#edf4fd",
    color: "#12355b",
    fontWeight: "600",
  },
  ".cm-activeLine": { backgroundColor: "#f7fafd" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "#d7e9ff !important",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#1f9d55",
    borderLeftWidth: "2px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "#eef4fb",
    border: "1px solid #d8e4f1",
    color: "#12355b",
    borderRadius: "4px",
    padding: "0 5px",
  },
  ".cm-panels": {
    backgroundColor: "#f7fafd",
    borderColor: "#e5ebf2",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(31,157,85,.16)",
    outline: "1px solid rgba(31,157,85,.35)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(31,157,85,.3)",
  },
  ".cm-tooltip": {
    border: "1px solid #dbe3ec",
    borderRadius: "8px",
    boxShadow: "0 10px 26px rgba(16,40,70,.12)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "#eaf4ff",
    color: "#12355b",
  },
});

export class MarkdownEditor {
  constructor(parent, options = {}) {
    this.parent = parent;
    this.onChange = options.onChange || (() => {});
    this.onCursor = options.onCursor || (() => {});
    this.onDropFiles = options.onDropFiles || (() => {});
    this.onCompile = options.onCompile || (() => {});
    this.silent = false;
    this.fontSize = options.fontSize || 13.5;
    this.extensions = this.buildExtensions();
    this.view = new EditorView({
      state: EditorState.create({
        doc: options.doc || "",
        extensions: this.extensions,
      }),
      parent,
    });
  }

  buildExtensions() {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter({ openText: "▾", closedText: "▸" }),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(markdownHighlight),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      markdown(),
      EditorView.lineWrapping,
      cmPlaceholder("Escribe tu manuscrito en Markdown…"),
      editorTheme,
      EditorView.theme({
        "&": { fontSize: `${this.fontSize}px` },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !this.silent) this.onChange();
        if (update.selectionSet || update.docChanged) {
          this.onCursor(this.getCursor());
        }
      }),
      EditorView.domEventHandlers({
        dragover: (event) => {
          if (event.dataTransfer?.types?.includes("Files")) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        drop: (event) => {
          const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
            file.type.startsWith("image/")
          );
          if (files.length) {
            event.preventDefault();
            this.onDropFiles(files);
            return true;
          }
          return false;
        },
      }),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            this.onCompile();
            return true;
          },
        },
        {
          key: "Mod-b",
          run: () => {
            this.wrapSelection("**", "**", "texto");
            return true;
          },
        },
        {
          key: "Mod-i",
          run: () => {
            this.wrapSelection("_", "_", "texto");
            return true;
          },
        },
        {
          key: "Mod-e",
          run: () => {
            this.wrapSelection("`", "`", "código");
            return true;
          },
        },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
    ];
  }

  getValue() {
    return this.view.state.doc.toString();
  }

  setValue(value, { keepHistory = false } = {}) {
    this.silent = true;
    if (keepHistory) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: value },
      });
    } else {
      this.view.setState(
        EditorState.create({
          doc: value,
          extensions: this.extensions,
        })
      );
    }
    this.silent = false;
    this.onCursor(this.getCursor());
  }

  focus() {
    this.view.focus();
  }

  getCursor() {
    const head = this.view.state.selection.main.head;
    const line = this.view.state.doc.lineAt(head);
    return {
      line: line.number,
      col: head - line.from + 1,
      selected: Math.abs(
        this.view.state.selection.main.to - this.view.state.selection.main.from
      ),
      totalLines: this.view.state.doc.lines,
    };
  }

  goToLine(number) {
    const doc = this.view.state.doc;
    const target = Math.max(1, Math.min(doc.lines, number));
    const line = doc.line(target);
    this.view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 40 }),
    });
    this.view.focus();
  }

  wrapSelection(before, after = before, placeholder = "texto") {
    const view = this.view;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to) || placeholder;
    const insert = `${before}${selected}${after}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: {
        anchor: from + before.length,
        head: from + before.length + selected.length,
      },
    });
    view.focus();
  }

  prefixLine(prefix) {
    const view = this.view;
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      selection: { anchor: pos + prefix.length },
    });
    view.focus();
  }

  insertText(text, { block = false } = {}) {
    const view = this.view;
    const { from, to } = view.state.selection.main;
    const doc = view.state.doc;
    let before = "";
    let after = "";
    if (block && from > 0) {
      const line = doc.lineAt(from);
      if (line.from !== from) before = "\n";
    }
    const insert = `${before}${text}${after}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
    view.focus();
  }

  insertAtCursor(text) {
    this.insertText(text);
  }

  /** Reemplaza un rango de líneas completo, útil para bloques de imagen. */
  replaceLines(startLine, endLine, text) {
    const doc = this.view.state.doc;
    const start = doc.line(Math.max(1, Math.min(doc.lines, startLine)));
    const end = doc.line(Math.max(1, Math.min(doc.lines, endLine)));
    this.view.dispatch({
      changes: { from: start.from, to: end.to, insert: text },
      selection: { anchor: start.from + text.length },
    });
    this.view.focus();
  }

  setFontSize(px) {
    this.fontSize = Math.max(11, Math.min(22, px));
    this.view.dom.style.fontSize = `${this.fontSize}px`;
  }

  clearHistory() {
    this.setValue(this.getValue());
  }

  destroy() {
    this.view.destroy();
  }
}
