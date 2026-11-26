import { startTransition, type FormEvent, type FormEventHandler } from "react";

/**
 * An `onSubmit` that sends a form to its action without React's automatic
 * reset. React 19 resets a `<form action={fn}>` after every action, including
 * a refused one: uncontrolled fields go back to their defaults, and controlled
 * selects and radios keep the reset value in the DOM while the state says
 * otherwise, so a retry sends something other than what the form shows.
 *
 * Use it with the action left on the form, which still works without
 * JavaScript: `<form action={action} onSubmit={submitInPlace(action)}>`.
 * `before` runs first, such as a confirmation; if it holds the submit
 * (`preventDefault`), nothing is sent.
 */
export function submitInPlace(action: (data: FormData) => void, before?: FormEventHandler<HTMLFormElement>) {
  return (event: FormEvent<HTMLFormElement>) => {
    before?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    const form = event.currentTarget;
    // The button that was used counts, as in a normal submit (name="operation" value="clear").
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(form, submitter && "form" in submitter && submitter.form === form ? submitter : undefined);
    startTransition(() => action(data));
  };
}
