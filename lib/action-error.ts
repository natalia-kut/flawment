type ErrorClass = abstract new (...args: never[]) => Error;

/**
 * The message a server action returns for a failure. A domain error (`Known`,
 * such as TaskError) is meant for the person and is shown as it is. Anything
 * else (a database fault, a serialization conflict that kept failing, a bug)
 * gets the generic `fallback` and is logged on the server, so it can be
 * diagnosed instead of disappearing behind "Please try again".
 */
export function actionError(error: unknown, Known: ErrorClass | null, fallback: string) {
  if (Known && error instanceof Known) return error.message;
  console.error(`Server action failed: ${fallback}`, error);
  return fallback;
}
