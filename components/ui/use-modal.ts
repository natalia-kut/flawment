import { useEffect, useRef } from "react";

/** Opens a dialog as a modal for as long as it is on screen; the page behind it does not scroll. */
export function useModal({ focusFirstField = false }: { focusFirstField?: boolean } = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    // Showing details: focus the dialog itself, so nothing looks "in edit" on open.
    // Creating: keep the browser's choice, the first field.
    if (!focusFirstField) dialog.focus();
    // The page's scrollbar keeps its place, so nothing jumps sideways.
    const page = document.documentElement;
    const { overflow } = document.body.style, { scrollbarGutter } = page.style;
    if (window.innerWidth > page.clientWidth) page.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      page.style.scrollbarGutter = scrollbarGutter;
    };
  }, [focusFirstField]);
  return ref;
}
