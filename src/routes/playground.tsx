import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Loader2,
  Terminal,
  AlertCircle,
  Sparkles,
  Clipboard,
  Check,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { tokenize } from "@devsuvam/odialang/dist/lexer/tokenizer";
import { Parser } from "@devsuvam/odialang/dist/parser/parser";
import { generateJavaScript } from "@devsuvam/odialang/dist/codegen/generate";
import { Reveal } from "../components/Reveal";
import { PythonIcon } from "../components/icons";
import { CodeEditor } from "../components/CodeEditor";
import { Transliterate } from "../components/Transliterate";
import { pageHead } from "../lib/seo";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";

export const Route = createFileRoute("/playground")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    search.tab === "odia" || search.tab === "translit" || search.tab === "python"
      ? { tab: search.tab }
      : {},
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

type Sample = { label: string; code: string };

const PYTHON_SAMPLES: Sample[] = [
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

print("\\nNumbers spelled out in Odia:")
for n in (7, 42, 1000, 250000):
    print(" ", n, "->", numbers.to_words(n))

print("\\nDigits:")
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
  {
    label: "Same word, two spellings",
    code: `# Odia can write ଡ଼ as one letter, or as ଡ with a nukta dot under it.
# Both look identical on screen, but Python sees different text — which
# quietly breaks search, dedup and word counts.
# indic-nlp-library is installed on demand when you run this.
import unicodedata
from indicnlp.normalize.indic_normalize import IndicNormalizerFactory

def spell_out(text):
    for c in text:
        print(f"    {c}   {unicodedata.name(c).replace('ORIYA ', '').lower()}")

one_letter = "ଓ" + chr(0x0B5C) + "ିଶା"
with_nukta = "ଓ" + chr(0x0B21) + chr(0x0B3C) + "ିଶା"

print("A:", one_letter, f"— {len(one_letter)} characters")
print("B:", with_nukta, f"— {len(with_nukta)} characters")
print("Same word?", one_letter == with_nukta)

print("\\nA is built from:")
spell_out(one_letter)
print("B is built from:")
spell_out(with_nukta)

normalizer = IndicNormalizerFactory().get_normalizer("or")
a, b = normalizer.normalize(one_letter), normalizer.normalize(with_nukta)
print("\\nAfter normalizing — same word?", a == b)
print("Both are now spelt the B way, with the nukta written out.")

# The same normalizer settles two more Odia spelling choices:
print("\\nଵ (va) folded to ବ (ba):", normalizer.normalize("ଵାରାଣସୀ"))
typed = "କ" + chr(0x0B47) + chr(0x0B3E)   # କ + vowel e + vowel aa
print("Vowel e + aa typed separately:", typed, "->", normalizer.normalize(typed),
      "(one vowel sign o)")
`,
  },
  {
    label: "Odia to other Indic lang transliteration",
    code: `# Indic scripts share a codepoint layout, so an akshara can be mapped
# across them arithmetically — no model, no network, no lookup table.
# It is lossy, and this sample says exactly where.
import unicodedata
from indicnlp.transliterate.unicode_transliterate import UnicodeIndicTransliterator
from indicnlp.normalize.indic_normalize import IndicNormalizerFactory

SCRIPTS = [("hi", "Devanagari"), ("bn", "Bengali"), ("gu", "Gujarati"),
           ("pa", "Gurmukhi"), ("ta", "Tamil"), ("te", "Telugu"),
           ("kn", "Kannada"), ("ml", "Malayalam")]

def what_went_missing(text, target):
    """Letters the target script has no home for. Printing them would show boxes."""
    stayed_odia, empty_slots = [], 0
    for c in UnicodeIndicTransliterator.transliterate(text, "or", target):
        if c.isspace():
            continue
        try:
            unicodedata.name(c)
        except ValueError:
            empty_slots += 1          # the arithmetic landed on an unused number
            continue
        if 0x0B00 <= ord(c) <= 0x0B7F and c not in stayed_odia:
            stayed_odia.append(c)
    notes = [f"{c} has no counterpart, stays Odia" for c in stayed_odia]
    if empty_slots:
        verb = "mark lands" if empty_slots == 1 else "marks land"
        notes.append(f"{empty_slots} {verb} on an unused slot — shown as a box")
    return "; ".join(notes) if notes else "maps cleanly"

sentence = "ଓଡ଼ିଶାର ରାଜଧାନୀ ଭୁବନେଶ୍ୱର"
print("as typed:", sentence)
for code, script in SCRIPTS:
    print(f"  {script:<12} {what_went_missing(sentence, code)}")

# Two Odia letters cause every problem above: ଡ଼ carries a nukta (Tamil has no
# nukta at all), and ୱ exists in no other script. Normalising both away costs a
# little fidelity and makes the sentence portable.
normalizer = IndicNormalizerFactory().get_normalizer("or", remove_nuktas=True, do_remap_wa=True)
portable = normalizer.normalize(sentence)
print("\\nnormalized:", portable)
for code, script in SCRIPTS:
    print(f"  {script:<12} {UnicodeIndicTransliterator.transliterate(portable, 'or', code)}")

# Mapping runs both ways, so it round-trips — minus what normalising dropped.
hindi = UnicodeIndicTransliterator.transliterate(portable, "or", "hi")
print("\\nback from Devanagari:", UnicodeIndicTransliterator.transliterate(hindi, "hi", "or"))
`,
  },
];

const ODIA_SAMPLES: Sample[] = [
  {
    label: "Namaskar",
    code: `# Odialang — Odia keywords, compiles to JavaScript.
# dhara = let, dekha = print, karya = function, sesa = end.
dhara nama = "Odisha"
dekha "Namaskar, " + nama + "!"

karya swagata(kie)
  fera "Swagata, " + kie + "!"
sesa

dekha swagata("bandhu")
`,
  },
  {
    label: "Conditions",
    code: `dhara marks = 85

jadi marks >= 60 tahale
  dekha "Pass — " + marks
nahele
  dekha "Fail — " + marks
sesa

dhara khusi = sata
jadi khusi tahale
  dekha "Khusi achi!"
sesa
`,
  },
  {
    label: "Loops",
    code: `# jebe = while
dhara ganana = 1
jebe ganana <= 5
  dekha "Ganana: " + ganana
  ganana = ganana + 1
sesa

# aarambha i = 1 ru 5  ->  for i in 1..5
aarambha i = 1 ru 5
  jadi i == 3 tahale
    chala
  sesa
  dekha "Sankhya: " + i
sesa
`,
  },
  {
    label: "Arrays & functions",
    code: `dhara nums = [10, 20, 30, 40, 50]
dekha "Length: " + nums.length
dekha "First: " + nums[0]

nums[0] = 100
dekha "Updated: " + nums

karya yoga(list)
  dhara total = 0
  aarambha i = 0 ru 4
    total = total + list[i]
  sesa
  fera total
sesa

dekha "Yoga: " + yoga(nums)
`,
  },
];

const SAMPLES: Record<Lang, Sample[]> = { python: PYTHON_SAMPLES, odia: ODIA_SAMPLES };

type Tab = "python" | "odia" | "translit";
/** The two tabs that are a code editor; "translit" is a tool, not an editor. */
type Lang = "python" | "odia";

const TABS: { id: Tab; label: string }[] = [
  { id: "python", label: "Python · openodia" },
  { id: "odia", label: "Odialang" },
  { id: "translit", label: "Transliteration" },
];

const FILENAME: Record<Lang, string> = { python: "main.py", odia: "main.odia" };

/**
 * Odialang is a compiler, not a runtime: tokenize → parse → emit JS. The three
 * modules we import are pure (no fs/vm), so the whole pipeline runs in the tab.
 * `dekha` emits `console.log`, so passing a shim as the function's `console`
 * parameter shadows the global and captures the output.
 */
function runOdia(src: string, write: (line: string) => void) {
  const js = generateJavaScript(new Parser(tokenize(src)).parseProgram());
  const log = (...args: unknown[]) => write(args.map((a) => String(a)).join(" "));
  new Function("console", js)({ log, error: log, warn: log, info: log });
}

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

/**
 * One shared boot for the whole tab. React StrictMode mounts the page twice in
 * dev, and the second pass used to find the <script id="pyodide-script"> tag
 * already in the DOM, assume it had finished loading, and blow up with
 * "loadPyodide missing" while the CDN request was still in flight. Memoising
 * the promise means the second caller waits on the first boot instead of
 * racing it — and a remount reuses the loaded runtime rather than re-fetching.
 */
let bootPromise: Promise<PyodideInterface> | null = null;
let onBootStatus: (msg: string) => void = () => {};

function bootPyodide(onStatus: (msg: string) => void) {
  onBootStatus = onStatus;
  bootPromise ??= (async () => {
    onBootStatus("Downloading Pyodide runtime…");
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.id = "pyodide-script";
      s.src = PYODIDE_SRC;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Pyodide from CDN"));
      document.body.appendChild(s);
    });

    if (!window.loadPyodide) throw new Error("Pyodide script loaded but loadPyodide missing");

    onBootStatus("Initializing Python runtime…");
    const py = await window.loadPyodide({
      indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
    });

    // pygments is a Pyodide-native package (faster than micropip) but
    // not auto-loaded. `rich` (a transitive dep of openodia) imports it
    // eagerly, so we need it on the path before openodia is imported.
    onBootStatus("Loading numpy + pygments…");
    await py.loadPackage(["numpy", "pygments"]);

    onBootStatus("Loading micropip and installing openodia…");
    await py.loadPackage("micropip");
    const micropip = py.pyimport("micropip");
    await micropip.install(["deep-translator", "faker", "rich", "openodia"]);

    return py;
  })().catch((err: unknown) => {
    // A failed boot must not be cached, or a retry can never recover.
    bootPromise = null;
    throw err;
  });
  return bootPromise;
}

function PlaygroundPage() {
  const navigate = useNavigate({ from: "/playground" });
  const { tab: tabFromUrl } = Route.useSearch();
  const [tab, setTabState] = useState<Tab>(tabFromUrl ?? "python");
  // The URL carries the tab so /playground?tab=translit is linkable (the footer
  // points at it). Replace rather than push: tab flipping is not history.
  const setTab = (next: Tab) => {
    setTabState(next);
    void navigate({ search: next === "python" ? {} : { tab: next }, replace: true });
  };
  // Everything below the tab bar is written against the two editor tabs.
  const lang: Lang = tab === "odia" ? "odia" : "python";
  // Per-language buffers, so switching tabs doesn't throw away an edit.
  const [codes, setCodes] = useState<Record<Lang, string>>({
    python: PYTHON_SAMPLES[0].code,
    odia: ODIA_SAMPLES[0].code,
  });
  const code = codes[lang];
  const setCode = (next: string) => setCodes((c) => ({ ...c, [lang]: next }));
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<PyodideStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [running, setRunning] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const pyodideRef = useRef<PyodideInterface | null>(null);
  // Lazy-install black on first format click rather than at boot — it's a
  // few extra MB and not every visitor cares about formatting.
  const blackInstalledRef = useRef(false);
  // Same deal for indic-nlp-library: only the samples that import `indicnlp`
  // and the transliteration tab need it, and it drags pandas in behind it.
  // A promise, not a boolean: debounced typing can ask for it twice at once.
  const indicRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    // Odialang compiles in-tab with no runtime to fetch — don't make an Odialang
    // visitor pay for a Python runtime download they never asked for. The
    // transliteration tab does need it: indic-nlp-library is a Python library.
    if (tab === "odia") return;
    let cancelled = false;
    setStatus("loading");

    bootPyodide(setStatusMsg)
      .then((py) => {
        if (cancelled) return;
        // Pyodide's batched stdout/stderr fires once per line with the
        // trailing newline stripped. We append it back so multi-line prints
        // render as multi-line text in the <pre>. Rebound per mount so the
        // handlers write to *this* component's state.
        py.setStdout({ batched: (s) => setOutput((o) => o + s + "\n") });
        py.setStderr({ batched: (s) => setOutput((o) => o + s + "\n") });
        pyodideRef.current = py;
        setStatus("ready");
        setStatusMsg("Ready. Hit Run to execute.");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("playground bootstrap failed", err);
        setStatus("error");
        setStatusMsg(err instanceof Error ? err.message : "Failed to initialize");
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const ready = tab === "odia" || status === "ready";

  const ensureIndic = useCallback(() => {
    indicRef.current ??= (async () => {
      const py = pyodideRef.current;
      if (!py) throw new Error("Python runtime is still loading");
      setStatusMsg("Installing indic-nlp-library…");
      await py.pyimport("micropip").install("indic-nlp-library");
      setStatusMsg("Ready.");
    })().catch((err: unknown) => {
      indicRef.current = null; // a failed install must stay retryable
      throw err;
    });
    return indicRef.current;
  }, []);

  // Native Fullscreen API: the browser already gives us Esc-to-exit, the
  // OS-level chrome hiding, and the `fullscreenchange` event to sync state.
  useEffect(() => {
    const sync = () => setIsFull(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen();
  }

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
    if (running) return;
    if (lang === "odia") {
      setOutput("");
      try {
        runOdia(code, (line) => setOutput((o) => o + line + "\n"));
      } catch (err) {
        setOutput((o) => o + String(err));
      }
      return;
    }
    const py = pyodideRef.current;
    if (!py) return;
    setRunning(true);
    setOutput("");
    try {
      if (/\bindicnlp\b/.test(code)) {
        await ensureIndic();
        setStatusMsg("Ready. Hit Run to execute.");
      }
      await py.runPythonAsync(code);
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
          Real code, running locally in your tab — no install, no setup, nothing sent to a server.
          Write Python against <code>openodia (PyPI)</code>, run <code>odialang</code> (a language
          with Odia keywords that compiles to JavaScript), or convert Odia into another Indic script
          as you type.
        </p>
        <Engines />
      </Reveal>

      <Reveal delay={0.1} className="mt-8">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full border px-4 py-1.5 text-xs transition ${
                tab === t.id
                  ? "border-neon bg-neon/10 text-neon"
                  : "border-border bg-surface text-muted-foreground hover:border-neon hover:text-neon"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.12} className="mt-4">
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
            ready
              ? "border-neon/40 bg-neon/5 text-foreground"
              : status === "error"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-border bg-surface text-muted-foreground"
          }`}
        >
          {tab !== "odia" && status === "loading" && (
            <Loader2 size={14} className="animate-spin shrink-0" />
          )}
          {ready && <PythonIcon size={14} />}
          {tab !== "odia" && status === "error" && <AlertCircle size={14} className="shrink-0" />}
          <span>
            {tab === "odia"
              ? "Ready. Odialang compiles to JavaScript in this tab — nothing to download."
              : tab === "translit" && status === "ready"
                ? "Ready. Conversion runs as you type, in this tab."
                : statusMsg || "Click Run when ready"}
          </span>
        </div>
      </Reveal>

      {tab !== "translit" && (
        <Reveal delay={0.15} className="mt-6">
          <div className="flex flex-wrap gap-2">
            {SAMPLES[lang].map((s) => (
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
      )}

      {tab === "translit" && (
        <Reveal delay={0.15} className="mt-6">
          <Transliterate
            py={status === "ready" ? pyodideRef.current : null}
            ensureIndic={ensureIndic}
          />
        </Reveal>
      )}

      <Reveal delay={0.2} className="mt-6" hidden={tab === "translit"}>
        <div ref={shellRef} className={isFull ? "h-full bg-background p-4" : ""}>
          <div className={`grid gap-4 lg:grid-cols-2 ${isFull ? "h-full" : ""}`}>
            <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="font-mono text-xs text-muted-foreground">{FILENAME[lang]}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleFullscreen}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-neon hover:text-neon"
                    title={isFull ? "Exit full screen (Esc)" : "Full screen"}
                    aria-label={isFull ? "Exit full screen" : "Full screen"}
                  >
                    {isFull ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                  {lang === "python" && (
                    <button
                      onClick={format}
                      disabled={!ready || formatting || running}
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
                  )}
                  <button
                    onClick={run}
                    disabled={!ready || running}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-neon to-magenta px-4 py-1.5 text-xs font-medium text-primary-foreground transition disabled:opacity-40"
                  >
                    {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Run
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  rows={16}
                  language={lang === "odia" ? "odialang" : "python"}
                  disabled={lang === "python" && status === "loading"}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
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
              <pre className="block min-h-[24rem] flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed text-foreground">
                {output || (
                  <span className="text-muted-foreground">
                    Output appears here after you click Run.
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.25} className="mt-10">
        <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
          <p>
            <strong>Heads up:</strong> the Python and Transliteration tabs download ~2 MB of
            WebAssembly and wheels on first load (the Odialang tab downloads nothing). After that it
            stays in cache.{" "}
            <a
              href="https://pypi.org/project/openodia/"
              target="_blank"
              rel="noreferrer"
              className="text-neon hover:underline"
            >
              See the openodia package docs
            </a>{" "}
            for full API. Transliteration and the two Indic-script samples pull in{" "}
            <a
              href="https://github.com/anoopkunchukuttan/indic_nlp_library"
              target="_blank"
              rel="noreferrer"
              className="text-neon hover:underline"
            >
              indic-nlp-library
            </a>{" "}
            the first time you use them. Features that need outbound HTTP (e.g. translation via{" "}
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
      <a
        href="https://pypi.org/project/openodia/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/5 px-3 py-1 text-neon"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-neon" />
        openodia (PyPI) · loaded
      </a>
      <a
        href="https://github.com/jyotishankar04/odialang"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/5 px-3 py-1 text-neon"
        title="Odia-keyword language that compiles to JavaScript"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-neon" />
        odialang · loaded
      </a>
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
