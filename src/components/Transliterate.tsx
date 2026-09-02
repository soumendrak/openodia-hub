/**
 * Live Odia → Indic-script transliteration, running on the same Pyodide
 * instance the playground's Python tab uses.
 *
 * There is no Run button: the conversion is cheap once the runtime is warm, so
 * it fires on a short debounce as you type. That is the whole reason this tab
 * exists rather than being one more code sample.
 *
 * Two honesty details that the code samples taught us:
 *   - Mapping is codepoint arithmetic, so it can land on a number the target
 *     script never assigned. Those render as boxes. We count them and say so
 *     rather than letting the user think their text is broken.
 *   - Four Odia letters (ଡ଼ ଢ଼ ୟ ୱ) have no counterpart in most scripts. The
 *     fold toggle rewrites them to their nearest base letter, which is what
 *     makes the output readable at the cost of a little fidelity.
 */
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Clipboard, Check, Loader2, AlertCircle } from "lucide-react";

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { set: (key: string, value: unknown) => void };
};

type Props = {
  /** Null until Pyodide has booted. */
  py: PyodideLike | null;
  /** Installs indic-nlp-library on first use; safe to call repeatedly. */
  ensureIndic: () => Promise<void>;
};

/** `note` only where the script name doesn't already name the language. */
const SCRIPTS: { code: string; name: string; note?: string }[] = [
  { code: "hi", name: "Devanagari", note: "Hindi, Marathi, Nepali, Sanskrit" },
  { code: "bn", name: "Bengali", note: "also Assamese" },
  { code: "gu", name: "Gujarati" },
  { code: "pa", name: "Gurmukhi", note: "Punjabi" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "si", name: "Sinhala" },
];

const PHRASES = [
  "ଓଡ଼ିଶାର ରାଜଧାନୀ ଭୁବନେଶ୍ୱର",
  "ମୋ ଭାଷା ମୋ ଗର୍ବ",
  "ଜଗନ୍ନାଥ ମନ୍ଦିର ପୁରୀରେ ଅଛି",
  "ଆମ ଭାଷା, ଆମ ପରିଚୟ ।",
];

/**
 * Returns [text, count-of-unrenderable-characters] as JSON so nothing has to
 * cross the JS/Python boundary as a proxy.
 */
const TRANSLITERATE_PY = `
import json, unicodedata as _ud
from indicnlp.transliterate.unicode_transliterate import UnicodeIndicTransliterator as _T
from indicnlp.normalize.indic_normalize import IndicNormalizerFactory as _F

_text = __src
if __fold:
    # ୟ is an atomic letter with no decomposition, so the normalizer cannot
    # reach it — rewrite it to ଯ first, then let the normalizer drop the
    # nuktas on ଡ଼/ଢ଼ and fold ୱ to ବ.
    _text = _text.replace(chr(0x0B5F), chr(0x0B2F))
    _text = _F().get_normalizer("or", remove_nuktas=True, do_remap_wa=True).normalize(_text)

_out = _T.transliterate(_text, "or", __target)

_gaps = 0
for _c in _out:
    if _c.isspace():
        continue
    try:
        _ud.name(_c)
    except ValueError:
        _gaps += 1

json.dumps([_out, _gaps])
`;

export function Transliterate({ py, ensureIndic }: Props) {
  const [source, setSource] = useState(PHRASES[0]);
  const [target, setTarget] = useState("hi");
  const [fold, setFold] = useState(true);
  const [result, setResult] = useState("");
  const [gaps, setGaps] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  // Keystrokes can outrun the runtime; only the newest request may set state.
  const requestRef = useRef(0);
  const selectId = useId();
  const inputId = useId();
  const foldId = useId();

  const script = SCRIPTS.find((s) => s.code === target)!;

  useEffect(() => {
    if (!py) return;
    if (!source.trim()) {
      setResult("");
      setGaps(0);
      return;
    }
    const id = ++requestRef.current;
    setPending(true);
    const timer = setTimeout(async () => {
      try {
        await ensureIndic();
        py.globals.set("__src", source);
        py.globals.set("__target", target);
        py.globals.set("__fold", fold);
        const raw = await py.runPythonAsync(TRANSLITERATE_PY);
        if (id !== requestRef.current) return;
        const [text, holes] = JSON.parse(String(raw)) as [string, number];
        setResult(text);
        setGaps(holes);
        setError("");
      } catch (err) {
        if (id !== requestRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (id === requestRef.current) setPending(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [py, ensureIndic, source, target, fold]);

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — clipboard can fail when the page isn't focused
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Try</span>
        {PHRASES.map((p) => (
          <button
            key={p}
            onClick={() => setSource(p)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              source === p
                ? "border-neon bg-neon/10 text-neon"
                : "border-border bg-surface text-muted-foreground hover:border-neon hover:text-neon"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
          <label
            htmlFor={inputId}
            className="border-b border-border px-4 py-2 text-xs text-muted-foreground"
          >
            Odia
          </label>
          <textarea
            id={inputId}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            rows={6}
            placeholder="ଏଠାରେ ଓଡ଼ିଆ ଲେଖନ୍ତୁ…"
            className="min-h-[10rem] flex-1 resize-none bg-transparent p-4 text-lg leading-relaxed outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border py-2 pl-2 pr-4">
            <div className="relative">
              <label htmlFor={selectId} className="sr-only">
                Convert to which script
              </label>
              <select
                id={selectId}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="cursor-pointer appearance-none rounded-full border border-transparent bg-transparent py-1 pl-2 pr-7 text-xs text-foreground transition hover:border-border focus:border-neon focus:outline-none"
              >
                {SCRIPTS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.note ? `${s.name} — ${s.note}` : s.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>
            <div className="flex-1" />
            {pending && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
            {result && (
              <button
                onClick={copy}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition hover:text-neon"
                title={`Copy ${script.name}`}
                aria-label={`Copy ${script.name} text`}
              >
                {copied ? <Check size={12} /> : <Clipboard size={12} />}
              </button>
            )}
          </div>
          <div
            aria-live="polite"
            className={`min-h-[10rem] flex-1 whitespace-pre-wrap p-4 text-lg leading-relaxed transition-opacity ${
              pending ? "opacity-40" : "opacity-100"
            }`}
          >
            {error ? (
              <span className="text-sm text-destructive">{error}</span>
            ) : result ? (
              result
            ) : (
              <span className="text-sm text-muted-foreground">
                {py ? "Type Odia on the left." : "Warming up the transliteration engine…"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={foldId} className="flex cursor-pointer items-start gap-3">
          <input
            id={foldId}
            type="checkbox"
            checked={fold}
            onChange={(e) => setFold(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--neon)]"
          />
          <span>
            Fold Odia-only letters <span className="font-medium text-foreground">ଡ଼ ଢ଼ ୟ ୱ</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              No other script has them. Folding writes each as its nearest base letter, which trades
              a little fidelity for output you can actually read.
            </span>
          </span>
        </label>
      </div>

      {gaps > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-saffron/40 bg-saffron/5 px-4 py-3 text-sm text-muted-foreground">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-saffron" />
          <span>
            {gaps === 1 ? "One character has" : `${gaps} characters have`} no equivalent in{" "}
            {script.name} — {gaps === 1 ? "it shows as a box" : "they show as boxes"}. Mapping is
            codepoint arithmetic, and some letters simply do not exist in every script.
          </span>
        </p>
      )}
    </div>
  );
}
