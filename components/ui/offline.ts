/** What a form shows when its request never reached the server (offline, a dropped connection). */
export const OFFLINE = "Could not reach the server, so this was not saved. Check your connection and try again: what you entered is still here.";

/**
 * Calls a server action, and turns a failed request into an error result
 * instead of a rejected promise. A rejection inside a transition reaches the
 * error boundary, which replaces the whole page and throws away the form.
 */
export async function reach<T>(call: () => Promise<T>, failed: T): Promise<T> {
  try {
    return await call();
  } catch {
    return failed;
  }
}

/** A server action for `useActionState`, with a failed request returned as `{ error: OFFLINE }`. */
export function offlineSafe<S, R extends { error?: string }>(action: (state: S, data: FormData) => Promise<R>) {
  return (state: S, data: FormData) => reach(() => action(state, data), { error: OFFLINE } as R);
}
