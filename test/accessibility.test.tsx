import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CodeEditor } from "../src/components/CodeEditor";
import { LanguageRuns } from "../src/components/LanguageRuns";
import { MagneticButton } from "../src/components/MagneticButton";
import { Marquee } from "../src/components/Marquee";
import { ScrollToTop } from "../src/components/ScrollToTop";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("allows Escape then Tab and Shift+Tab to leave the labeled editor without editing", () => {
  const changed = vi.fn();
  render(<CodeEditor value="print(1)" onChange={changed} />);
  const editor = screen.getByRole("textbox", { name: /Python code editor/ });
  fireEvent.keyDown(editor, { key: "Escape" });
  expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
  expect(editor).not.toHaveAttribute("data-tab-navigation");
  fireEvent.keyDown(editor, { key: "Escape" });
  fireEvent.keyDown(editor, { key: "Shift", shiftKey: true });
  expect(fireEvent.keyDown(editor, { key: "Tab", shiftKey: true })).toBe(true);
  expect(editor).not.toHaveAttribute("data-tab-navigation");
  expect(changed).not.toHaveBeenCalled();
  fireEvent.keyDown(editor, { key: "Escape" });
  fireEvent.blur(editor);
  fireEvent.focus(editor);
  expect(editor).not.toHaveAttribute("data-tab-navigation");
  expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(false);
  expect(changed).toHaveBeenCalled();
});
it("preserves escape through modifier-only events and cancels it on ordinary typing", () => {
  const changed = vi.fn();
  render(<CodeEditor value="    print(1)" onChange={changed} />);
  const editor = screen.getByRole("textbox", { name: /Python code editor/ });
  for (const key of ["Shift", "Control", "Alt", "Meta", "AltGraph"]) {
    fireEvent.keyDown(editor, { key: "Escape" });
    fireEvent.keyDown(editor, { key });
    expect(editor).toHaveAttribute("data-tab-navigation", "true");
    expect(fireEvent.keyDown(editor, { key: "Tab", shiftKey: true })).toBe(true);
    expect(editor).not.toHaveAttribute("data-tab-navigation");
  }
  expect(changed).not.toHaveBeenCalled();
  fireEvent.keyDown(editor, { key: "Escape" });
  fireEvent.keyDown(editor, { key: "a" });
  expect(editor).not.toHaveAttribute("data-tab-navigation");
  expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(false);
  expect(changed).toHaveBeenCalled();
});
it("disables magnetic pointer travel and smooth scrolling for reduced motion", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(window, "scrollY", { value: 500, configurable: true, writable: true });
  const { container } = render(
    <>
      <MagneticButton onClick={() => {}}>Move</MagneticButton>
      <ScrollToTop />
    </>,
  );
  fireEvent.mouseMove(container.firstChild!, { clientX: 200, clientY: 100 });
  expect(screen.getByText("Move").style.transform).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Scroll to top" }));
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
});

it("allows users to pause automatic marquee scrolling and hides the repeated copy", () => {
  const { container } = render(<Marquee items={["Odia"]} />);
  const control = screen.getByRole("button", { name: "Pause scrolling" });
  fireEvent.click(control);
  expect(control).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector(".animate-marquee")).toHaveStyle({ animationPlayState: "paused" });
  fireEvent.click(screen.getByRole("button", { name: "Resume scrolling" }));
  expect(control).toHaveAttribute("aria-pressed", "false");
  expect(container.querySelector(".animate-marquee")).toHaveStyle({
    animationPlayState: "running",
  });
  expect(screen.getAllByText("Odia")[1].closest("[aria-hidden]")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

it.each([
  ["", []],
  ["English title", [["en", "English title"]]],
  ["ଓଡ଼ିଆ", [["or", "ଓଡ଼ିଆ"]]],
  [
    "ଏଆଇ AI ଓଡ଼ିଆ?",
    [
      ["or", "ଏଆଇ"],
      ["en", " AI "],
      ["or", "ଓଡ଼ିଆ"],
      ["en", "?"],
    ],
  ],
])(
  "preserves catalog text and tags Odia script without labeling English as Odia: %s",
  (text, expected) => {
    const { container } = render(<LanguageRuns text={text as string} />);
    expect(container.textContent).toBe(text);
    expect(
      [...container.querySelectorAll("span")].map((span) => [span.lang, span.textContent]),
    ).toEqual(expected);
  },
);
