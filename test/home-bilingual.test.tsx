import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
