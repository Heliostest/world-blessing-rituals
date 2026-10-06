// Helpers for jsdom tests that render App components and act on them.
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

// Tells React this is a test, so updates inside act() flush without warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** Renders `node` into a fresh element in the document. */
export function renderUI(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    host,
    rerender(next: ReactNode) {
      act(() => root.render(next));
    },
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

/** Types into a React-controlled field the way a browser does. */
export function typeInto(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field),
    "value",
  )!.set!;
  act(() => {
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Clicks `el` and lets React settle. */
export function clickOn(el: Element) {
  act(() => {
    (el as HTMLElement).click();
  });
}

/** Lets pending promises (and the effects they trigger) settle. */
export async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}
