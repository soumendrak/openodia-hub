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
 * Nothing soft-wraps. Wrapping used to put the caret on the wrong line: `rows`
 * sizes the textarea in *logical* lines, so a wrapped line overflowed it, the
 * vertical scrollbar took 15px off the textarea's content width, and the two
 * layers then broke lines at different columns — the <pre> laid out 31 visual
 * lines where the textarea laid out 32, so a click below the first divergence
 * landed a line or more off. It also made one gutter number cover two rows.
 * With `white-space: pre` a logical line is a visual line everywhere, and the
 * overlay mirrors the textarea's horizontal scroll offset.
 *
 * The textarea is also not user-resizable. It already grows to fit every line,
 * so the handle only let you drag it *shorter* than its content — and the
 * gutter then held the flex row open at full height while the textarea scrolled
 * inside it, which the overlay had no way to follow.
 *
 * Layered conveniences on the textarea:
 *   - Tab inserts 4 spaces (Shift+Tab dedents); selections indent/dedent block-wise
 *   - Enter preserves the previous line's indent, and adds an extra level
 *     after a line ending in `:` (Python block convention)
 *
 * Token colors live in styles.css (scoped to `.code-editor-pre`) so they
 * cooperate with the site's dark/light theme variables.
 */
import { useMemo, useRef, type ChangeEvent, type KeyboardEvent, type UIEvent } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-python";

// Odialang (github.com/jyotishankar04/odialang) has no Prism grammar of its
// own. It is small enough that the whole language fits here: ASCII identifiers,
// `#` / `//` comments, JS-style strings and operators.
Prism.languages.odialang = {
  comment: /(?:#|\/\/).*/,
  string: /"(?:\\.|[^"\\])*"/,
  keyword:
    /\b(?:dhara|dekha|jadi|tahale|nahele|jebe|karya|fera|sata|micha|sesa|kar|aarambha|ru|ruha|chala)\b/,
  number: /\b\d+(?:\.\d+)?\b/,
  function: /\b[a-zA-Z_]\w*(?=\s*\()/,
  operator: /[+\-*/%]=?|[=!<>]=?|&&|\|\|/,
  punctuation: /[[\](),.]/,
};

// Prism auto-highlights every `<pre><code class="language-*">` on the page once
// the document is ready, and `highlightElement` adds `tabindex="0"` to the
// <pre>. That mutates the DOM out from under React and shows up as a hydration
// mismatch. We only use the string API (`Prism.highlight`), so switch the
// automatic pass off. The flag is read when the deferred pass fires, so setting
// it here — after the import evaluates — is in time.
Prism.manual = true;

const INDENT = "    "; // 4 spaces — PEP 8 default

type Props = {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  disabled?: boolean;
  language?: "python" | "odialang";
};

function getLineRange(text: string, selStart: number, selEnd: number) {
  const lineStart = text.lastIndexOf("\n", selStart - 1) + 1;
  const lineEnd = text.indexOf("\n", selEnd);
  return { lineStart, lineEnd: lineEnd === -1 ? text.length : lineEnd };
}

export function CodeEditor({ value, onChange, rows, disabled, language = "python" }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  // One row of slack: without wrapping a long line brings a horizontal
  // scrollbar, which eats ~15px of the box's height and would otherwise pull
  // in a vertical scrollbar for those 15px alone.
  const visibleRows = Math.max(rows ?? 16, lineCount) + 1;

  // Trailing newline makes the overlay match the textarea's final empty line.
  const highlighted = useMemo(
    () => Prism.highlight(value, Prism.languages[language], language) + "\n",
    [value, language],
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

  /**
   * Long lines scroll the textarea sideways; the overlay has to travel with it
   * or the highlighting drifts away from the caret. `overflow: hidden` still
   * permits a programmatic scroll, which is what moves the <pre> here.
   *
   * Only the horizontal offset needs mirroring: the textarea is sized to hold
   * every line (see `visibleRows`), so it never scrolls vertically.
   */
  function handleScroll(e: UIEvent<HTMLTextAreaElement>) {
    if (preRef.current) preRef.current.scrollLeft = e.currentTarget.scrollLeft;
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
          ref={preRef}
          aria-hidden
          className="code-editor-pre pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-4 leading-[1.5]"
        >
          <code
            className={`language-${language}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
        <textarea
          ref={taRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          rows={visibleRows}
          // `wrap="off"` is the attribute browsers honour for textarea soft
          // wrapping; the CSS below keeps the overlay in the same mode.
          wrap="off"
          disabled={disabled}
          className="relative block w-full resize-none overflow-x-auto overflow-y-hidden whitespace-pre bg-transparent p-4 leading-[1.5] text-transparent outline-none disabled:opacity-50"
          style={{ caretColor: "var(--color-foreground)" }}
        />
      </div>
    </div>
  );
}
