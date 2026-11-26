import type { MouseEvent, PointerEvent } from "react";

/**
 * Closes a modal `<dialog>` on a click on its backdrop, and only then. A click
 * is reported on the dialog itself also when it ends a drag that started
 * inside, such as selecting text past the dialog's edge, so the press has to
 * have started on the backdrop too. Spread onto the dialog:
 * `<dialog {...closeOnBackdrop(onClose)}>`.
 */
export function closeOnBackdrop(close: () => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => {
      // Kept on the element, so a re-render between press and release does not lose it.
      event.currentTarget.dataset.pressedBackdrop = String(event.target === event.currentTarget);
    },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      const pressed = event.currentTarget.dataset.pressedBackdrop === "true";
      delete event.currentTarget.dataset.pressedBackdrop;
      if (pressed && event.target === event.currentTarget) close();
    },
  };
}
