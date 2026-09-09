import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, cleanup, render } from "@testing-library/react";
import { ODIA_PHRASE, COLLECTION, COMMUNITIES } from "../src/lib/pattachitra";
import { CHANNELS } from "../src/data/channels";
import { OdiaGlyph } from "../src/components/OdiaGlyph";
import { usePattachitraMotion } from "../src/hooks/usePattachitraMotion";
import { fetchChannelVideos } from "../src/lib/sources/videos";

afterEach(cleanup);

/**
 * These are the parts of the Pattachitra direction that are cultural claims
 * rather than styling: the phrase, the letter, and who we say runs what. They
 * are exactly the details a later refactor would silently "tidy" — a stray
 * danda, a nearby glyph, a rewritten link — so each one gets an assertion that
 * fails loudly instead of a screenshot nobody re-reads.
 */
describe("the hero phrase", () => {
  it("is ଆମ ଭାଷା ଆମ ପରିଚୟ, with no trailing danda", () => {
    expect(ODIA_PHRASE).toBe("ଆମ ଭାଷା ଆମ ପରିଚୟ");
    expect(ODIA_PHRASE.endsWith("।")).toBe(false);
    expect(ODIA_PHRASE.endsWith("|")).toBe(false);
    // No danda anywhere: the two clauses run on. This is the maintainer's
    // wording — don't "correct" it back to sentence punctuation.
    expect(ODIA_PHRASE).not.toContain("।");
  });
});

describe("the hero letter", () => {
  /**
   * The letter must be the *exact* Noto Sans Oriya U+0B13 contour. The
   * standalone SVG under public/ is the reference copy; if the component's
   * path ever drifts from it, someone has redrawn or substituted the glyph.
   */
  it("draws the same contour as public/pattachitra/odia-o.svg", () => {
    const reference = readFileSync("public/pattachitra/odia-o.svg", "utf8");
    const referencePath = reference.match(/ d="([^"]+)"/)?.[1];
    expect(referencePath).toBeTruthy();

    const { container } = render(<OdiaGlyph />);
    const contour = container.querySelector("#odia-contour");
    expect(contour?.getAttribute("d")).toBe(referencePath);
  });

  it("is announced as the Odia letter", () => {
    const { container } = render(<OdiaGlyph />);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("ଓ");
  });
});

describe("community attribution", () => {
  it("registers GDG Cloud Bhubaneswar as a video channel", () => {
    const gdg = CHANNELS.find((c) => c.handle === "gdgcloudbbsr");
    expect(gdg).toBeDefined();
    expect(gdg?.name).toBe("GDG Cloud Bhubaneswar");
    expect(gdg?.url).toBe("https://www.youtube.com/@gdgcloudbbsr");
    expect(gdg?.channelId).toBe("UC9xed7VnseanYSek7sF0Ksw");
  });

  it("sends every community link to the community's own home", () => {
    // Not to a page on this site: OpenOdia points at these groups, it does not
    // host or operate them.
    for (const c of COMMUNITIES) {
      expect(c.href).toMatch(/^https:\/\//);
      expect(c.href).not.toContain("openodia.com");
    }
    expect(COMMUNITIES.map((c) => c.href)).toContain(
      "https://gdg.community.dev/gdg-cloud-bhubaneswar/",
    );
  });
});

describe("the collection", () => {
  it("points at the three directory routes", () => {
    expect(COLLECTION.map((c) => c.to)).toEqual(["/tools", "/models", "/datasets"]);
  });
});

/** Renders the hook and exposes its return value for assertion. */
function motionHarness() {
  const seen: { current: string } = { current: "" };
  function Probe() {
    seen.current = usePattachitraMotion();
    return null;
  }
  render(<Probe />);
  return seen;
}

describe("decorative motion", () => {
  /**
   * Three infinite animations run on the hero panel. Nothing to look at means
   * nothing to spend frames on — and pausing rather than removing means the
   * letter doesn't snap back to the start of its turn on return.
   *
   * prefers-reduced-motion is handled entirely in CSS; scripts/check-pattachitra.mjs
   * asserts the computed animation-name in a real reduced-motion context.
   */
  it("pauses while the tab is hidden and resumes after", () => {
    const m = motionHarness();
    expect(m.current).toBe("patta");

    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(m.current).toBe("patta page-hidden");

    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(m.current).toBe("patta");
    hidden.mockRestore();
  });
});

describe("the tutorials channel feed", () => {
  const FEED = `<feed><entry><yt:videoId>abc123</yt:videoId><title>A talk</title><published>2026-01-01T00:00:00Z</published></entry></feed>`;

  afterEach(() => vi.unstubAllGlobals());

  /**
   * YouTube answers a burst of RSS requests from one IP with 500, not 429.
   * Without the retry, four of the five channels came back empty — and an
   * empty channel is indistinguishable from a real one, so it disappeared
   * from /tutorials for the hour the result stayed cached.
   */
  it("recovers a channel whose feed 500s on the first attempt", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return calls === 1
        ? new Response("<html>Error 500</html>", { status: 500 })
        : new Response(FEED, { status: 200 });
    });

    const channel = await fetchChannelVideos(
      "openodia",
      "OpenOdia",
      "https://www.youtube.com/@openodia",
      "UCMiaqPIaXo19LuQx0zbEFAA",
    );

    expect(calls).toBeGreaterThan(1);
    expect(channel.videos.map((v) => v.id)).toEqual(["abc123"]);
  });

  it("gives up after the retries rather than hanging", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));

    const channel = await fetchChannelVideos("x", "X", "https://example.com", "UC0");
    expect(channel.videos).toEqual([]);
    expect(channel.name).toBe("X");
  });
});
