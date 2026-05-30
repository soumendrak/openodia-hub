import { useEffect, type RefObject } from "react";

/**
 * A hook that registers a global event listener for search shortcuts.
 * - Pressing '/' focuses the input (unless the user is already typing in an input/textarea).
 * - Pressing 'Escape' blurs the input when focused.
 */
export function useSearchShortcut(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true");

      if (e.key === "/") {
        if (isTyping) return;
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "Escape") {
        if (activeEl === inputRef.current) {
          inputRef.current?.blur();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [inputRef]);
}
