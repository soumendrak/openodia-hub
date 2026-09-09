/**
 * Browser checks for the Pattachitra direction.
 *
 * These are the contracts a unit test can't hold: what the layout does at real
 * widths, whether the art actually loaded, and where the hero letter sits
 * partway through a 22-second turn. Run against a dev or preview server:
 *
 *   bun run dev &
 *   bun scripts/check-pattachitra.mjs [http://localhost:9090]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:9090";
const WIDTHS = [
  { name: "320px", width: 320, height: 800 },
  { name: "390px", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const ROUTES = ["/", "/tutorials"];

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

/** The letter's reserved band inside the painted panel. Below this line sit
 *  the lower ornament and both peacocks, which must stay visible. */
const PEACOCK_LINE = 0.75;

async function overflow(page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
}

/** Freezes every animation on the page at `ms` into its timeline. */
async function seek(page, ms) {
  await page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t;
    }
  }, ms);
}

async function main() {
  const browser = await chromium.launch();

  for (const route of ROUTES) {
    for (const size of WIDTHS) {
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
      const raw = [];
      // A 503 from /api/videos is the documented "YouTube is unavailable"
      // answer, not a defect in the page — the rail falls back to its static
      // list and every channel still renders. The console message for a failed
      // request carries no URL, so it is correlated with the response instead,
      // and only then discounted. Everything else still fails the check.
      const upstream503 = [];
      page.on("pageerror", (e) => raw.push(String(e)));
      page.on("console", (m) => m.type() === "error" && raw.push(m.text()));
      page.on("response", (r) => {
        if (r.url().includes("/api/videos") && r.status() === 503) upstream503.push(r.url());
      });

      await page.goto(BASE + route, { waitUntil: "networkidle" });
      const { scroll, inner } = await overflow(page);
      check(
        scroll <= inner,
        `${route} @ ${size.name}: no horizontal overflow`,
        `${scroll}/${inner}`,
      );
      const errors = upstream503.length
        ? raw.filter((t) => !/Failed to load resource.*\b503\b/.test(t))
        : raw;
      check(
        errors.length === 0,
        `${route} @ ${size.name}: no console errors`,
        errors[0] ?? (upstream503.length ? `(${upstream503.length} upstream 503 discounted)` : ""),
      );

      // The header is position:fixed, so it can push a control off-screen
      // without ever changing scrollWidth. Measure it directly.
      const chrome = await page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        return [...document.querySelectorAll("header a, header button")]
          .map((el) => ({
            name: el.textContent?.trim().slice(0, 20) || el.ariaLabel,
            right: el.getBoundingClientRect().right,
          }))
          .filter((x) => x.right > w)
          .map((x) => `${x.name} @${Math.round(x.right)}>${w}`);
      });
      check(
        chrome.length === 0,
        `${route} @ ${size.name}: every header control is on screen`,
        chrome.join(", "),
      );

      // The painted frame is the artwork; a broken src leaves an empty red box.
      const frames = await page.$$eval("img[src*='ceremonial-frame']", (imgs) =>
        imgs.map((i) => ({ complete: i.complete, w: i.naturalWidth })),
      );
      check(frames.length > 0, `${route} @ ${size.name}: painted frame present`);
      check(
        frames.every((f) => f.complete && f.w > 0),
        `${route} @ ${size.name}: painted frame loaded`,
        JSON.stringify(frames),
      );
      await page.close();
    }
  }

  // ── Text contrast inside the painted composition, in both themes ─────────
  //
  // .patta hard-codes ink-on-ochre colours. Anything inside it that shows the
  // *page* background instead of the composition's own ground turns
  // dark-on-dark the moment the site is in dark mode — which is exactly what
  // happened when the ground was dropped. Measured, not eyeballed.
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.evaluate((t) => localStorage.setItem("theme", t), theme);

    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      const bad = await page.evaluate(() => {
        const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
        const lum = ([r, g, b]) => {
          const f = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a, b) => {
          const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
          return (x + 0.05) / (y + 0.05);
        };
        const groundOf = (el) => {
          for (let n = el; n; n = n.parentElement) {
            const c = parse(getComputedStyle(n).backgroundColor);
            if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c.slice(0, 3);
          }
          return [255, 255, 255];
        };

        const out = [];
        for (const el of document.querySelectorAll(".patta *")) {
          const text = [...el.childNodes]
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .join("")
            .trim();
          if (!text) continue;
          // Decorative art — the rosette, the rules, the oversized ଓ on the
          // tutorial panel — is aria-hidden and exempt from text contrast.
          if (el.closest('[aria-hidden="true"]')) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.opacity === "0") continue;
          const size = parseFloat(cs.fontSize);
          const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
          const need = large ? 3 : 4.5;
          const r = ratio(parse(cs.color).slice(0, 3), groundOf(el));
          if (r < need) {
            out.push(`${text.slice(0, 28)} ${r.toFixed(2)}:1 (needs ${need})`);
          }
        }
        return out;
      });
      check(
        bad.length === 0,
        `${route} @ ${theme}: painted text meets contrast`,
        bad.slice(0, 3).join(" · "),
      );
    }
    await page.close();
  }

  // ── Focus ring, and the mobile community names ───────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });

    // A focus ring the same lightness as the ground is not a focus ring. The
    // original gold measured 1.01:1 against the palm-leaf paper.
    const ring = await page.evaluate(() => {
      const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
      const lum = ([r, g, b]) => {
        const f = (v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const el = document.querySelector(".patta a, .patta button");
      el.focus();
      const cs = getComputedStyle(el);
      let ground = [255, 255, 255];
      for (let n = el; n; n = n.parentElement) {
        const c = (getComputedStyle(n).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) {
          ground = c.slice(0, 3);
          break;
        }
      }
      const [x, y] = [lum(parse(cs.outlineColor)), lum(ground)].sort((a, b) => b - a);
      return { ratio: (x + 0.05) / (y + 0.05), width: parseFloat(cs.outlineWidth) };
    });
    check(
      ring.ratio >= 3 && ring.width >= 2,
      "focus ring is visible on the painted ground",
      `${ring.ratio.toFixed(2)}:1 at ${ring.width}px`,
    );

    // The <br> in a two-part name is hidden here, so the space has to be its
    // own text node or the halves collide: "GDG CloudBhubaneswar". Asserted
    // against the exact names — a camelCase heuristic would flag "OdiaGenAI".
    const names = await page.$$eval(".community-card h3", (hs) =>
      hs.map((h) => h.textContent.trim().replace(/\s+/g, " ")),
    );
    for (const expected of ["GDG Cloud Bhubaneswar", "TFUG Bhubaneswar"]) {
      check(
        names.includes(expected),
        `community name reads "${expected}" at 390px`,
        names.join(" | "),
      );
    }
    await page.close();
  }

  // ── Every community channel reaches the page ──────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + "/tutorials", { waitUntil: "networkidle" });
    const rendered = await page.$$eval("section h2", (hs) => hs.map((h) => h.textContent.trim()));
    for (const name of [
      "OdiaGenAI",
      "OpenOdia",
      "Odias in ML",
      "TFUG Bhubaneswar",
      "GDG Cloud Bhubaneswar",
    ]) {
      check(rendered.includes(name), `/tutorials lists ${name}`, rendered.join(" | "));
    }
    await page.close();
  }

  // ── Hero letter clearance, at three points of the 22s loop ────────────────
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const readLetter = () =>
    page.evaluate(() => {
      const panel = document.querySelector(".painted-panel").getBoundingClientRect();
      const letter = document.querySelector(".hero-letter").getBoundingClientRect();
      return {
        top: (letter.top - panel.top) / panel.height,
        bottom: (letter.bottom - panel.top) / panel.height,
        transform: getComputedStyle(document.getElementById("letter-mount")).transform,
      };
    });

  // Guard against the whole clearance check silently passing because seeking
  // did nothing: a quarter-turn in must not look like the start of the loop.
  await seek(page, 0);
  const atStart = await readLetter();
  await seek(page, 5500);
  const atQuarter = await readLetter();
  check(atStart.transform !== atQuarter.transform, "seeking the letter animation has an effect");

  // 0s and 11s are the two extremes of the turn; 22s closes the loop back on
  // the start. The letter's box is widest — and lowest — at exactly these.
  for (const t of [0, 11000, 22000]) {
    await seek(page, t);
    const box = await readLetter();
    check(
      box.bottom <= PEACOCK_LINE,
      `hero letter clears the peacocks at ${t / 1000}s`,
      `bottom ${box.bottom.toFixed(3)} of panel (limit ${PEACOCK_LINE})`,
    );
    check(box.top > 0, `hero letter stays inside the panel at ${t / 1000}s`, box.top.toFixed(3));
  }

  // The panel itself must never move — only the letter and the light do.
  const panelAnimations = await page.evaluate(
    () => document.querySelector(".painted-panel").getAnimations().length,
  );
  check(panelAnimations === 0, "the painted panel itself does not animate", `${panelAnimations}`);
  await page.close();

  // ── Reduced motion removes the decorative movement ───────────────────────
  const quiet = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
  const quietPage = await quiet.newPage();
  await quietPage.goto(BASE + "/", { waitUntil: "networkidle" });

  // Scoped to the painted composition: the site-wide reduced-motion rule
  // shortens every other animation to 0.01ms, so a document-wide count would
  // still be non-zero and prove nothing.
  const decorative = await quietPage.evaluate(() =>
    [".hero-letter", "#letter-mount", ".gold-glint", ".ambient-light"]
      .map((sel) => {
        const el = document.querySelector(sel);
        return el ? `${sel}:${getComputedStyle(el).animationName}` : `${sel}:missing`;
      })
      .filter((s) => !s.endsWith(":none") && !s.endsWith(":missing")),
  );
  check(
    decorative.length === 0,
    "reduced motion: the hero animations are removed",
    decorative.join(", "),
  );

  await quiet.close();

  await browser.close();
  console.log(failures === 0 ? "\nall pattachitra checks passed" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
