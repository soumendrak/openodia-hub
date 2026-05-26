/**
 * Minimal Python-friendly code editor used by /playground.
 *
 * Architecture:
 *   - A real <textarea> handles all input, selection, accessibility, and the
 *     caret. Its text is `color: transparent`, but the caret stays visible.
 *   - A <pre> overlay behind the textarea renders the same string with Prism
 *     syntax highlighting. Both share font / line-height / padding so tokens
 *     line up over their textarea equivalents.
 *   - A line-number gutter on the left, kept aligned via shared line-height.
 *
 * Layered conveniences on the textarea:
 *   - Tab inserts 4 spaces (Shift+Tab dedents); selections indent/dedent block-wise
 *   - Enter preserves the previous line's indent, and adds an extra level
 *     after a line ending in `:` (Python block convention)
 *
 * Token colors live in styles.css (scoped to `.code-editor-pre`) so they
 * cooperate with the site's dark/light theme variables.
 */
import { useMemo, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-python";

const INDENT = "    "; // 4 spaces — PEP 8 default

type Props = {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  disabled?: boolean;
};

function getLineRange(text: string, selStart: number, selEnd: number) {
  const lineStart = text.lastIndexOf("\n", selStart - 1) + 1;
  const lineEnd = text.indexOf("\n", selEnd);
  return { lineStart, lineEnd: lineEnd === -1 ? text.length : lineEnd };
}

export function CodeEditor({ value, onChange, rows, disabled }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  const visibleRows = Math.max(rows ?? 16, lineCount);

  // Trailing newline makes the overlay match the textarea's final empty line.
  const highlighted = useMemo(
    () => Prism.highlight(value, Prism.languages.python, "python") + "\n",
    [value],
  );

  function setSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.selectionStart = start;
      ta.selectionEnd = end;
    });
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd } = ta;
    const text = ta.value;
    const hasSelection = selectionStart !== selectionEnd;

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        const { lineStart, lineEnd } = getLineRange(text, selectionStart, selectionEnd);
        const before = text.slice(0, lineStart);
        const block = text.slice(lineStart, lineEnd);
        const after = text.slice(lineEnd);

        let dedented = 0;
        const newBlock = block
          .split("\n")
          .map((line) => {
            const match = line.match(/^( {1,4}|\t)/);
            if (!match) return line;
            dedented += match[0].length;
            return line.slice(match[0].length);
          })
          .join("\n");

        if (dedented === 0) return;
        onChange(before + newBlock + after);
        const firstLineMatch = block.split("\n", 1)[0].match(/^( {1,4}|\t)/);
        const firstLineRemoved = firstLineMatch ? firstLineMatch[0].length : 0;
        setSelection(
          Math.max(lineStart, selectionStart - firstLineRemoved),
          Math.max(lineStart, selectionEnd - dedented),
        );
        return;
      }

      if (hasSelection) {
        const { lineStart, lineEnd } = getLineRange(text, selectionStart, selectionEnd);
        const before = text.slice(0, lineStart);
        const block = text.slice(lineStart, lineEnd);
        const after = text.slice(lineEnd);
        const lines = block.split("\n");
        const newBlock = lines.map((l) => INDENT + l).join("\n");
        onChange(before + newBlock + after);
        setSelection(selectionStart + INDENT.length, selectionEnd + INDENT.length * lines.length);
        return;
      }

      const next = text.slice(0, selectionStart) + INDENT + text.slice(selectionEnd);
      onChange(next);
      setSelection(selectionStart + INDENT.length, selectionStart + INDENT.length);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
      const currentLine = text.slice(lineStart, selectionStart);
      const indentMatch = currentLine.match(/^[ \t]*/);
      let indent = indentMatch ? indentMatch[0] : "";
      if (currentLine.trimEnd().endsWith(":")) indent += INDENT;
      const insert = "\n" + indent;
      const next = text.slice(0, selectionStart) + insert + text.slice(selectionEnd);
      onChange(next);
      setSelection(selectionStart + insert.length, selectionStart + insert.length);
    }
  }

  return (
    <div className="flex font-mono text-sm">
      <div
        aria-hidden
        className="select-none border-r border-border bg-background/30 px-3 py-4 text-right text-muted-foreground/40"
        style={{ lineHeight: "1.5" }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="relative flex-1">
        <pre
          aria-hidden
          className="code-editor-pre pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words p-4 leading-[1.5]"
        >
          <code className="language-python" dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
        <textarea
          ref={taRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          rows={visibleRows}
          disabled={disabled}
          className="relative block w-full resize-y bg-transparent p-4 leading-[1.5] text-transparent outline-none disabled:opacity-50"
          style={{ caretColor: "var(--color-foreground)" }}
        />
      </div>
    </div>
  );
}
