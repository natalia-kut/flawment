import { useEffect, useRef } from "react";

/**
 * Shows a dialog as a modal and returns how to close it. Closing puts the keyboard focus back
 * on whatever opened it (a card, a file tile, a button): browsers only do that for a dialog that
 * is still on the page, and React removes ours before its effect cleanup runs.
 */
export function openModal(dialog: HTMLDialogElement) {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.showModal();
  return () => {
    dialog.close();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
}

/** Opens a dialog as a modal for as long as it is on screen; the page behind it does not scroll. */
export function useModal({ focusFirstField = false }: { focusFirstField?: boolean } = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const closeModal = openModal(dialog);
    // Showing details: focus the dialog itself, so nothing looks "in edit" on open.
    // Creating: keep the browser's choice, the first field.
    if (!focusFirstField) dialog.focus();
    // The page's scrollbar keeps its place, so nothing jumps sideways.
    const page = document.documentElement;
    const { overflow } = document.body.style, { scrollbarGutter } = page.style;
    if (window.innerWidth > page.clientWidth) page.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    return () => {
      closeModal();
      document.body.style.overflow = overflow;
      page.style.scrollbarGutter = scrollbarGutter;
    };
  }, [focusFirstField]);
  return ref;
}
