import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Loader2, Terminal, AlertCircle, Sparkles, Clipboard, Check } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { PythonIcon } from "../components/icons";
import { CodeEditor } from "../components/CodeEditor";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Playground · OpenOdia" },
      {
        name: "description",
        content:
          "Run Python in the browser with the openodia package — transliteration, normalization, and more. No setup, no install.",
      },
      { property: "og:title", content: "Playground · OpenOdia" },
      {
        property: "og:description",
        content: "Browser-based Python playground with the openodia package pre-loaded.",
      },
    ],
  }),
  component: PlaygroundPage,
});

const PYODIDE_VERSION = "0.27.0";
const PYODIDE_SRC = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;

const SAMPLES: { label: string; code: string }[] = [
  {
    label: "Transliterate (English → Odia)",
    code: `import openodia
from openodia import transliterator

print(transliterator.to_odia("odia bhasha"))
print(transliterator.to_odia("namaskar"))
`,
  },
  {
    label: "Random Odia name",
    code: `from openodia import names

for _ in range(5):
    print(names.male_name())
`,
  },
  {
    label: "Numeric → Odia digits",
    code: `from openodia import numbers

for n in [0, 1, 9, 42, 2026]:
    print(n, "→", numbers.to_odia_digits(n))
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

      py.setStdout({ batched: (s) => setOutput((o) => o + s) });
      py.setStderr({ batched: (s) => setOutput((o) => o + s) });

      setStatusMsg("Loading numpy…");
      await py.loadPackage("numpy");
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
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Playground</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Run <span className="text-gradient">openodia</span> in your browser.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          The openodia Python package, pre-loaded and ready in the browser via Pyodide. No install,
          no setup — try transliteration, name generation, and number conversion below.
        </p>
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

          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
              <Terminal size={12} />
              <span className="font-mono">output</span>
              <div className="flex-1" />
              {output && (
                <button
                  onClick={copyOutput}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition hover:text-neon"
                  title="Copy output"
                  aria-label="Copy output"
                >
                  {copied ? <Check size={12} /> : <Clipboard size={12} />}
                </button>
              )}
            </div>
            <pre className="block min-h-[24rem] overflow-x-auto whitespace-pre-wrap p-4 font-mono text-sm text-foreground">
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
