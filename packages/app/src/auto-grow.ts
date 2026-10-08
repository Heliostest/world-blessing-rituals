import { useLayoutEffect, useRef } from "react";

/**
 * Fits a text area's height to its text as it is typed, so a rounded field
 * needs no native resize grip and never scrolls inside itself. It never
 * shrinks below the height its `rows` give it. Pass the field's value.
 */
export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    // Back to the rows' height first, so the text can shrink it again.
    field.style.height = "";
    const style = getComputedStyle(field);
    const borders =
      (parseFloat(style.borderTopWidth) || 0) +
      (parseFloat(style.borderBottomWidth) || 0);
    if (field.scrollHeight > field.clientHeight)
      field.style.height = `${field.scrollHeight + borders}px`;
  }, [value]);
  return ref;
}
