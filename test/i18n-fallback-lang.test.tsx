import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../src/locales/or", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/locales/or")>();
  return { or: { ...actual.or, "nav.home": "" } };
});
import { I18nProvider, T, useTranslation } from "../src/lib/i18n";
import { or } from "../src/locales/or";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it.each([
  ["or", "nav.home", "Home", "en"],
  ["or", "nav.about", or["nav.about"], null],
  ["en", "nav.home", "Home", null],
] as const)(
  "marks only English fallbacks in the %s locale (%s)",
  async (locale, key, text, lang) => {
    localStorage.setItem("locale", locale);
    render(
      <I18nProvider>
        <p data-testid="host">
          <T k={key} />
        </p>
      </I18nProvider>,
    );
    await screen.findByText(text);
    const span = screen.getByTestId("host").querySelector("span");
    expect(span?.getAttribute("lang") ?? null).toBe(lang);
  },
);

function Labelled() {
  return <a aria-label="x" lang={useTranslation().fallbackLang("nav.home")} data-testid="link" />;
}

it.each([
  ["or", "en"],
  ["en", null],
] as const)("marks a fallback accessible name as English in %s", async (locale, lang) => {
  localStorage.setItem("locale", locale);
  render(
    <I18nProvider>
      <Labelled />
    </I18nProvider>,
  );
  await screen.findByTestId("link");
  await vi.waitFor(() => expect(screen.getByTestId("link").getAttribute("lang")).toBe(lang));
});
