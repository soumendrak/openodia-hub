import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Play,
  Loader2,
  Terminal,
  AlertCircle,
  Sparkles,
  Clipboard,
  Check,
  Trash2,
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { PythonIcon } from "../components/icons";
import { CodeEditor } from "../components/CodeEditor";
import { pageHead } from "../lib/seo";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";

export const Route = createFileRoute("/playground")({
  head: () =>
    pageHead({
      path: "playground",
      title: "Odia NLP playground · OpenOdia",
      description:
        "Try Odia language tools in your browser — normalisation, sentence segmentation, syllables, numerals, stopwords, and frequency stats. No setup, no install.",
      ogDescription: "Run Odia language tools in the browser. No install, no setup.",
    }),
  component: PlaygroundPage,
});

const PYODIDE_VERSION = "0.27.0";
const PYODIDE_SRC = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;

const SAMPLES: { label: string; code: string }[] = [
  {
    label: "Quick tour",
    code: `# A whirlwind tour of openodia — tokenization, language detection,
# stopword removal, name generation, alphabet stats. All offline.
from openodia import ud, name, alphabet

text = (
    "ଓଡ଼ିଆ ଭାଷା ଭାରତର ଏକ ସମୃଦ୍ଧ ଶାସ୍ତ୍ରୀୟ ଭାଷା । "
    "ଆମ ସମ୍ବିଧାନ ଅନୁଯାୟୀ ଏହା ଗୋଟିଏ ସରକାରୀ ଭାଷା ।"
)

print("Detected language:")
print(" ", ud.detect_language(text))

print("\\nSentences:")
for s in ud.sentence_tokenizer(text):
    print(" •", s.strip())

tokens = ud.word_tokenizer(text)
print(f"\\n{len(tokens)} tokens, first 8: {tokens[:8]}")

print("\\nWithout stopwords:")
print(" ", ud.remove_stopwords(text, get_str=True))

print(f"\\nAlphabet: {len(alphabet.vowels)} vowels, "
      f"{len(alphabet.consonants)} consonants, "
      f"{len(alphabet.numbers)} digits")

print(f"\\nA random Odia name: {name.generate_names(count=1)[0]}")
`,
  },
  {
    label: "Tokenize Odia text",
    code: `from openodia import ud

text = "ଓଡ଼ିଆ ଭାଷା ଓ ସଂସ୍କୃତି ମୋ ଗର୍ବ । ଆସନ୍ତୁ ଆମେ ସମସ୍ତେ ମିଶି ଏହାକୁ ଆଗକୁ ବଢ଼ାଇବା ।"

print("Words:")
for t in ud.word_tokenizer(text):
    print(" •", t)

print("\\nSentences:")
for s in ud.sentence_tokenizer(text):
    print(" •", s.strip())

print("\\nContent words only (stopwords removed):")
print(" ", ud.remove_stopwords(text, get_str=True))
`,
  },
  {
    label: "Random Odia names",
    code: `from openodia import name

print("First names:", name.generate_firstnames(5, name_type="male"))
print("Surnames:", name.generate_surnames(5))
`,
  },
  {
    label: "Odia alphabet",
    code: `from openodia import alphabet

print("Vowels:", alphabet.vowels)
print("Consonants:", alphabet.consonants[:5], "...")
print("Digits:", alphabet.numbers)
print("Matras:", alphabet.matras)
`,
  },
  {
    label: "Clean & segment",
    code: `# Normalise, clean, then split into sentences.
# Odia uses ।  (danda) as its full stop, so a Latin-only splitter
# runs whole paragraphs together.
from openodia import normalize, clean, sentences

raw = "  ଓଡ଼ିଆ ଏକ ଭାରତୀୟ ଭାଷା।  ଏହା ଓଡ଼ିଶାର ରାଜ୍ୟ ଭାଷା।  Odia is also written in Latin.  "

text = clean(normalize(raw))
print("cleaned:", text)

for i, s in enumerate(sentences(text), 1):
    print(f"{i}. {s}")

print("\\nStrict mode (Odia terminators only):")
for s in sentences(text, mode="strict"):
    print(" -", s)
`,
  },
  {
    label: "Syllables & numerals",
    code: `# Aksharas (orthographic syllables) and Odia number words.
from openodia import syllable, numbers

word = "ଭୁବନେଶ୍ୱର"
print(word, "->", syllable.split(word))
print("aksharas:", syllable.count(word))
print("hyphenated:", syllable.hyphenate(word))

print()
for n in (7, 42, 1000, 250000):
    print(n, "->", numbers.to_words(n))

print()
print("ASCII digits to Odia:", numbers.ascii_to_odia("2026"))
print("Odia digits to ASCII:", numbers.odia_to_ascii("୨୦୨୬"))
`,
  },
  {
    label: "Corpus stats",
    code: `# Frequency distribution, n-grams, and stopword coverage
# over a small Odia sample.
from openodia import FreqDist, ngrams, Stopwords, sentences

text = (
    "ଓଡ଼ିଆ ଭାଷା ଏକ ପ୍ରାଚୀନ ଭାଷା। "
    "ଓଡ଼ିଆ ଭାଷା ଓଡ଼ିଶାର ରାଜ୍ୟ ଭାଷା। "
    "ଏହି ଭାଷା ଭାରତର ଶାସ୍ତ୍ରୀୟ ଭାଷା ମଧ୍ୟରେ ଅନ୍ୟତମ।"
)

fd = FreqDist(text)
print("tokens:", fd.total_count)          # property, not a call
print("most common:", fd.most_common(5))
print("type-token ratio:", round(fd.ttr, 3))
print("entropy:", round(fd.entropy(), 3))

print("\\nbigrams:", list(ngrams(text, 2))[:5])

stop = Stopwords.default()
print("\\nstopword coverage:", round(stop.coverage(text.split()), 3))
`,
  },
];

type PyodideStatus = "idle" | "loading" | "ready" | "error";

declare global {
  interface Window {
    loadPyodide?: (opts?: { indexURL?: string }) => Promise<PyodideInterface>;
  }
}

type Micropip = { install: (pkg: string | string[]) => Promise<void> };
type PyodideInterface = {
  loadPackage: (name: string | string[]) => Promise<void>;
  pyimport: (name: string) => Micropip;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { set: (key: string, value: unknown) => void };
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
};

function PlaygroundPage() {
  const [code, setCode] = useState(SAMPLES[0].code);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<PyodideStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [running, setRunning] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const pyodideRef = useRef<PyodideInterface | null>(null);
  // Lazy-install black on first format click rather than at boot — it's a
  // few extra MB and not every visitor cares about formatting.
  const blackInstalledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setStatus("loading");
      setStatusMsg("Downloading Pyodide runtime (~10 MB)…");

      const existing = document.getElementById("pyodide-script") as HTMLScriptElement | null;
      if (!existing) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.id = "pyodide-script";
          s.src = PYODIDE_SRC;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Pyodide from CDN"));
          document.body.appendChild(s);
        });
      }

      if (cancelled) return;
      if (!window.loadPyodide) throw new Error("Pyodide script loaded but loadPyodide missing");

      setStatusMsg("Initializing Python runtime…");
      const py = await window.loadPyodide({
        indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
      });
      if (cancelled) return;

      // Pyodide's batched stdout/stderr fires once per line with the
      // trailing newline stripped. We append it back so multi-line prints
      // render as multi-line text in the <pre>.
      py.setStdout({ batched: (s) => setOutput((o) => o + s + "\n") });
      py.setStderr({ batched: (s) => setOutput((o) => o + s + "\n") });

      // pygments is a Pyodide-native package (faster than micropip) but
      // not auto-loaded. `rich` (a transitive dep of openodia) imports it
      // eagerly, so we need it on the path before openodia is imported.
      setStatusMsg("Loading numpy + pygments…");
      await py.loadPackage(["numpy", "pygments"]);
      if (cancelled) return;

      setStatusMsg("Loading micropip and installing openodia…");
      await py.loadPackage("micropip");
      const micropip = py.pyimport("micropip");
      await micropip.install(["deep-translator", "faker", "rich", "openodia"]);
      if (cancelled) return;

      pyodideRef.current = py;
      setStatus("ready");
      setStatusMsg("Ready. Hit Run to execute.");
    }

    bootstrap().catch((err: unknown) => {
      if (cancelled) return;
      console.error("playground bootstrap failed", err);
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to initialize");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — clipboard can fail when the page isn't focused
    }
  }

  async function run() {
    if (!pyodideRef.current || running) return;
    setRunning(true);
    setOutput("");
    try {
      await pyodideRef.current.runPythonAsync(code);
    } catch (err) {
      setOutput((o) => o + String(err));
    } finally {
      setRunning(false);
    }
  }

  async function format() {
    const py = pyodideRef.current;
    if (!py || formatting) return;
    setFormatting(true);
    try {
      if (!blackInstalledRef.current) {
        setStatusMsg("Installing black for formatting…");
        const micropip = py.pyimport("micropip");
        await micropip.install("black");
        blackInstalledRef.current = true;
        setStatusMsg("Ready. Hit Run to execute.");
      }
      py.globals.set("__src", code);
      const result = await py.runPythonAsync(
        "import black\nblack.format_str(__src, mode=black.Mode())",
      );
      if (typeof result === "string") {
        setCode(result);
      }
    } catch (err) {
      // Don't replace code on parse errors — surface the failure in output.
      setOutput((o) => o + "\n[format failed] " + String(err) + "\n");
    } finally {
      setFormatting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Playground", url: "https://openodia.com/playground" },
        ])}
      />
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Playground</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Try Odia language tools <span className="text-gradient">in your browser</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Real Python, running locally in your tab via Pyodide — no install, no setup, nothing sent
          to a server. The engine loaded today is <code>openodia (PyPI)</code>; it is the first of
          several, not the point of the page.
        </p>
        <Engines />
      </Reveal>

      <Reveal delay={0.1} className="mt-8">
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
            status === "error"
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : status === "ready"
                ? "border-neon/40 bg-neon/5 text-foreground"
                : "border-border bg-surface text-muted-foreground"
          }`}
        >
          {status === "loading" && <Loader2 size={14} className="animate-spin shrink-0" />}
          {status === "ready" && <PythonIcon size={14} />}
          {status === "error" && <AlertCircle size={14} className="shrink-0" />}
          <span>{statusMsg || "Click Run when ready"}</span>
        </div>
      </Reveal>

      <Reveal delay={0.15} className="mt-6">
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => setCode(s.code)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:border-neon hover:text-neon"
            >
              {s.label}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.2} className="mt-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">main.py</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={format}
                  disabled={status !== "ready" || formatting || running}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-neon hover:text-neon disabled:opacity-40"
                  title="Format with black"
                >
                  {formatting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  Format
                </button>
                <button
                  onClick={run}
                  disabled={status !== "ready" || running}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-neon to-magenta px-4 py-1.5 text-xs font-medium text-primary-foreground transition disabled:opacity-40"
                >
                  {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Run
                </button>
              </div>
            </div>
            <CodeEditor value={code} onChange={setCode} rows={16} disabled={status === "loading"} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
              <Terminal size={12} />
              <span className="font-mono">output</span>
              <div className="flex-1" />
              {output && (
                <>
                  <button
                    onClick={copyOutput}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition hover:text-neon"
                    title="Copy output"
                    aria-label="Copy output"
                  >
                    {copied ? <Check size={12} /> : <Clipboard size={12} />}
                  </button>
                  <button
                    onClick={() => setOutput("")}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition hover:text-destructive"
                    title="Clear output"
                    aria-label="Clear output"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
            <pre className="block min-h-[24rem] overflow-x-auto whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed text-foreground">
              {output || (
                <span className="text-muted-foreground">
                  Output appears here after you click Run.
                </span>
              )}
            </pre>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.25} className="mt-10">
        <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
          <p>
            <strong>Heads up:</strong> first load downloads ~20 MB of WebAssembly and Python wheels.
            After that it stays in cache.{" "}
            <a
              href="https://pypi.org/project/openodia/"
              target="_blank"
              rel="noreferrer"
              className="text-neon hover:underline"
            >
              See the openodia package docs
            </a>{" "}
            for full API. Features that need outbound HTTP (e.g. translation via{" "}
            <code className="font-mono">deep-translator</code>) may be blocked by CORS in the
            browser sandbox.
          </p>
        </div>
      </Reveal>
    </div>
  );
}

/**
 * R5: the playground is about Odia language tooling, so it names the engine it
 * is running rather than presenting one package as the whole page. Engines that
 * are not wired up yet say so instead of being implied.
 */
function Engines() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Engines</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/5 px-3 py-1 text-neon">
        <span className="h-1.5 w-1.5 rounded-full bg-neon" />
        openodia (PyPI) · loaded
      </span>
      <span
        className="rounded-full border border-border px-3 py-1 text-muted-foreground"
        title="No open transliteration endpoint is reachable to wire this to yet."
      >
        Transliteration · not yet
      </span>
      <span
        className="rounded-full border border-border px-3 py-1 text-muted-foreground"
        title="Inference demos for community models are planned."
      >
        Community model inference · planned
      </span>
      <Link to="/contribute" className="text-neon hover:underline">
        Suggest an engine →
      </Link>
    </div>
  );
}
