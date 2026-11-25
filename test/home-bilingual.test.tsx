import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider, useTranslation } from "../src/lib/i18n";
import { Footer } from "../src/components/Footer";
import { Route } from "../src/routes/index";
import type { ComponentType } from "react";

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: Record<string, unknown>) => ({
      options,
      useLoaderData: () => ({
        projects: 5,
        models: { value: 3, approx: false },
        datasets: { value: 4, approx: false },
      }),
    }),
    Link: ({ children, to, ...rest }: { children?: React.ReactNode; to?: string }) =>
      React.createElement("a", { ...rest, href: to }, children),
  };
});
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined }) }));
vi.mock("../src/components/Reveal", () => ({
  Reveal: ({ children }: { children?: React.ReactNode }) => children,
}));
vi.mock("../src/components/ContributorGrid", () => ({ ContributorGrid: () => null }));
vi.mock("../src/components/ContributorLeaderboard", () => ({ ContributorLeaderboard: () => null }));
vi.mock("../src/hooks/usePattachitraMotion", () => ({ usePattachitraMotion: () => "patta" }));
const Home = (Route as unknown as { options: { component: ComponentType } }).options.component;
function Switch() {
  const { locale, setLocale } = useTranslation();
  return (
    <button onClick={() => setLocale(locale === "en" ? "or" : "en")}>Switch test language</button>
  );
}
function App() {
  return (
    <I18nProvider>
      <Switch />
      <Home />
      <Footer />
    </I18nProvider>
  );
}

function closestLang(el: Element): string | null {
  return el.closest("[lang]")?.getAttribute("lang") ?? null;
}

function elementOwningText(root: HTMLElement, text: string): HTMLElement {
  const owners = [root, ...Array.from(root.querySelectorAll("*"))].filter((el) =>
    Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && Boolean(n.textContent?.includes(text)),
    ),
  );
  if (owners.length !== 1) {
    throw new Error(`expected 1 owner of ${JSON.stringify(text)}, got ${owners.length}`);
  }
  return owners[0] as HTMLElement;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("bilingual high-traffic UI", () => {
  it("switches real hero, statistics and footer strings without translating upstream text", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /Explore the collection/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch test language" }));
    expect(screen.getByRole("link", { name: /ସଂଗ୍ରହ ଦେଖନ୍ତୁ/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).closest("section")).toHaveAttribute(
      "lang",
      "or",
    );
    expect(screen.getByText("ତାଲିକାଭୁକ୍ତ ପ୍ରକଳ୍ପ")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveAttribute("lang", "or");
    expect(screen.getByRole("link", { name: /ଅନୁବାଦରେ ସାହାଯ୍ୟ/ })).toHaveAttribute(
      "href",
      "/translation-status",
    );
    expect(screen.getByText(/From the community/)).toBeInTheDocument();
    expect(localStorage.getItem("locale")).toBe("or");
    fireEvent.click(screen.getByRole("button", { name: "Switch test language" }));
    expect(screen.getByRole("link", { name: /Explore the collection/ })).toBeInTheDocument();
  });
  it("restores the saved language after remount", () => {
    localStorage.setItem("locale", "or");
    render(<App />);
    expect(screen.getByRole("link", { name: /ଶିଖିବା ଆରମ୍ଭ କରନ୍ତୁ/ })).toBeInTheDocument();
    expect(screen.getAllByText("ଆମ ଭାଷା ଆମ ପରିଚୟ")).toHaveLength(2);
  });

  it("marks fixed English footer names as English and keeps Odia marks in Odia", () => {
    render(<App />);
    const footerEn = screen.getByRole("contentinfo");
    expect(footerEn).toHaveAttribute("lang", "en");
    expect(closestLang(within(footerEn).getByText("ଓ"))).toBe("or");
    expect(closestLang(within(footerEn).getByText("ଆମ ଭାଷା ଆମ ପରିଚୟ"))).toBe("or");
    fireEvent.click(screen.getByRole("button", { name: "Switch test language" }));
    const footerOr = screen.getByRole("contentinfo");
    expect(footerOr).toHaveAttribute("lang", "or");
    const wordmark = within(footerOr).getByRole("link", { name: /OpenOdia/ });
    expect(closestLang(within(wordmark).getByText("OpenOdia"))).toBe("en");
    expect(closestLang(within(wordmark).getByText("ଓ"))).toBe("or");
    const github = within(footerOr).getByRole("link", { name: "GitHub" });
    const youtube = within(footerOr).getByRole("link", { name: "YouTube" });
    expect(github).toHaveAttribute("aria-label", "GitHub");
    expect(youtube).toHaveAttribute("aria-label", "YouTube");
    expect(closestLang(github)).toBe("en");
    expect(closestLang(youtube)).toBe("en");
    expect(closestLang(within(footerOr).getByText("ଆମ ଭାଷା ଆମ ପରିଚୟ"))).toBe("or");
    const api = within(footerOr).getByRole("link", { name: "API" });
    expect(closestLang(api)).toBe("en");
    const copyrightLine = within(footerOr).getByText((_, el) =>
      Boolean(
        el &&
        el.tagName === "P" &&
        /©\s+\d+/.test(el.textContent ?? "") &&
        el.textContent?.includes("OpenOdia"),
      ),
    );
    expect(closestLang(elementOwningText(copyrightLine, "OpenOdia"))).toBe("en");
    expect(closestLang(elementOwningText(copyrightLine, "ନିର୍ମିତ"))).toBe("or");
    expect(closestLang(elementOwningText(copyrightLine, "ଓଡ଼ିଶାରେ"))).toBe("or");
  });
});
