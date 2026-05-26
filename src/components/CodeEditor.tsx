/**
 * Minimal Python-friendly code editor used by /playground.
 *
 * Backed by a real <textarea> for accessibility + native selection, with three
 * developer-conveniences layered on top:
 *
 *   - line-number gutter that stays aligned with the textarea
 *   - Tab inserts 4 spaces (Shift+Tab dedents); selections indent/dedent block-wise
 *   - Enter preserves the previous line's indent, and adds an extra level
 *     after a line ending in `:` (Python block convention)
 *
 * No syntax highlighting — that would mean a second hidden layer with
 * pixel-perfect alignment to the textarea, which is fiddly. Plain monospaced
 * text is fine for a playground.
 */
import { useRef, useMemo, type ChangeEvent, type KeyboardEvent } from "react";

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

  function setSelection(start: number, end: number) {
    // Defer so React's value update lands before we touch selection.
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
        // Dedent: remove up to INDENT.length spaces (or one tab) from the
        // start of every line in the selection.
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
        const next = before + newBlock + after;
        onChange(next);
        const firstLineMatch = block.split("\n", 1)[0].match(/^( {1,4}|\t)/);
        const firstLineRemoved = firstLineMatch ? firstLineMatch[0].length : 0;
        setSelection(
          Math.max(lineStart, selectionStart - firstLineRemoved),
          Math.max(lineStart, selectionEnd - dedented),
        );
        return;
      }

      if (hasSelection) {
        // Indent every line in the selection by one level.
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

      // Plain Tab inserts spaces at the cursor.
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
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        rows={visibleRows}
        disabled={disabled}
        className="block flex-1 resize-y bg-transparent p-4 leading-[1.5] outline-none disabled:opacity-50"
        wrap="off"
      />
    </div>
  );
}
