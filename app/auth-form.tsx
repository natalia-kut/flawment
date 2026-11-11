"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { login, register } from "@/lib/auth/actions";
import { NAME_PATTERN, NAME_RULE } from "@/lib/auth/names";
import styles from "./auth-form.module.css";

type Errors = Record<string, string>;

/**
 * A field's problem in plain words, from the same attributes the server's
 * rules mirror (required, minLength, pattern, type) plus the one rule the
 * browser cannot know: the two passwords must match. Lengths are checked by
 * hand: the browser only flags them for typed values, not autofilled ones.
 */
function fieldError(input: HTMLInputElement): string {
  const { validity, value, minLength, maxLength } = input;
  if (validity.valueMissing) return "This field is required";
  if (input.name === "email" && validity.typeMismatch) return "Enter a valid email address, like name@company.com";
  const tooShort = minLength > 0 && value.length < minLength;
  const tooLong = maxLength > 0 && value.length > maxLength;
  if ((input.name === "first_name" || input.name === "last_name") && validity.patternMismatch) return NAME_RULE;
  if (input.name === "username") {
    if (tooShort || tooLong) return "Use 3–40 characters";
    if (validity.patternMismatch) return "Letters, numbers, dots, dashes and underscores only";
  }
  if (tooShort) return `Use at least ${minLength} characters (${value.length} so far)`;
  if (tooLong) return `Use at most ${maxLength} characters`;
  if (input.name === "confirm_password") {
    const password = input.form?.elements.namedItem("password") as HTMLInputElement | null;
    if (password && value !== password.value) return "Passwords do not match";
  }
  return "";
}

function Field({ label, name, error, onCheck, ...input }: {
  label: string; name: string; error?: string; onCheck: (input: HTMLInputElement, live: boolean) => void;
} & InputHTMLAttributes<HTMLInputElement>) {
  const errorId = "error-" + name;
  return <label className={error ? styles.invalid : undefined}>{label}
    <input name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
      onBlur={(event) => onCheck(event.currentTarget, false)}
      onInput={(event) => onCheck(event.currentTarget, true)} {...input} />
    {error && <span id={errorId} className={styles.fieldError}>{error}</span>}
  </label>;
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const [state, action, pending] = useActionState(registering ? register : login, {});
  const [errors, setErrors] = useState<Errors>({});

  // On blur: show the field's problem. While typing: only update a problem
  // that is already shown, so nobody is told off mid-word.
  function check(input: HTMLInputElement, live: boolean) {
    setErrors((current) => {
      const next = { ...current };
      const update = (field: HTMLInputElement) => {
        if (live && !(field.name in current)) return;
        const message = fieldError(field);
        if (message) next[field.name] = message; else delete next[field.name];
      };
      update(input);
      // Changing the password can fix or break the confirmation.
      const confirm = input.name === "password" && input.form?.elements.namedItem("confirm_password");
      if (confirm instanceof HTMLInputElement && confirm.value) update(confirm);
      return next;
    });
  }

  function validateAll(event: FormEvent<HTMLFormElement>) {
    const inputs = [...event.currentTarget.querySelectorAll("input")];
    const found: Errors = {};
    for (const input of inputs) {
      const message = fieldError(input);
      if (message) found[input.name] = message;
    }
    setErrors(found);
    const first = inputs.find((input) => found[input.name]);
    if (first) { event.preventDefault(); first.focus(); }
  }

  const field = { onCheck: check } as const;
  return <main className={styles.page}>
    {/* A large, faded wordmark behind the card. */}
    <div className={styles.backdrop} aria-hidden="true">flawment<span>.</span></div>
    <section className={styles.card}>
      <Link className={styles.brand} href="/">flawment<span>.</span></Link>
      <h1>{registering ? "Create an account" : "Welcome back"}</h1>
      <p className={styles.lead}>{registering ? "Create projects and collaborate with your team." : "Sign in to your projects."}</p>
      {/* noValidate: our messages replace the browser's bubbles; the same rules still apply. */}
      <form action={action} onSubmit={validateAll} noValidate className={"workspace-form " + styles.form}>
        {registering && <>
          <div className="form-row">
            <Field {...field} label="First name" name="first_name" error={errors.first_name} autoComplete="given-name" required maxLength={80} pattern={NAME_PATTERN} />
            <Field {...field} label="Last name" name="last_name" error={errors.last_name} autoComplete="family-name" required maxLength={80} pattern={NAME_PATTERN} />
          </div>
          <div className="form-row">
            <Field {...field} label="Username" name="username" error={errors.username} autoComplete="username" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.\-]+" />
            <Field {...field} label="Email" name="email" type="email" error={errors.email} autoComplete="email" required maxLength={254} />
          </div>
          <div className="form-row">
            <Field {...field} label="Password" name="password" type="password" error={errors.password} autoComplete="new-password" placeholder="At least 10 characters" required minLength={10} maxLength={128} />
            <Field {...field} label="Confirm password" name="confirm_password" type="password" error={errors.confirm_password} autoComplete="new-password" required minLength={10} maxLength={128} />
          </div>
        </>}
        {!registering && <>
          <Field {...field} label="Email" name="email" type="email" error={errors.email} autoComplete="username" required maxLength={254} />
          <Field {...field} label="Password" name="password" type="password" error={errors.password} autoComplete="current-password" required maxLength={128} />
        </>}
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <button className={"primary-button " + styles.submit} disabled={pending}>{pending ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
      </form>
      <p className={styles.switch}>
        {registering ? "Already registered? " : "New here? "}
        <Link href={registering ? "/login" : "/register"}>{registering ? "Sign in" : "Create an account"}</Link>
      </p>
    </section>
  </main>;
}
