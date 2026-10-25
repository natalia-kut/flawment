"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/lib/auth/actions";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const [state, action, pending] = useActionState(registering ? register : login, {});
  return <main className="auth-page"><section className="auth-card">
    <Link className="auth-brand" href="/">flawment<span>.</span></Link>
    <p className="eyebrow">YOUR PROJECT WORKSPACE</p>
    <h1>{registering ? "Create an account" : "Welcome back"}</h1>
    <p>{registering ? "Create projects and collaborate with your team." : "Sign in to your projects."}</p>
    <form action={action} className="workspace-form">
      {registering && <>
        <label>First name<input name="first_name" autoComplete="given-name" required maxLength={80} /></label>
        <label>Last name<input name="last_name" autoComplete="family-name" required maxLength={80} /></label>
        <label>Username<input name="username" autoComplete="username" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.\-]+" /></label>
      </>}
      <label>Email<input name="email" type="email" autoComplete={registering ? "email" : "username"} required maxLength={254} /></label>
      <label>Password<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 10 : 1} maxLength={128} /></label>
      {registering && <label>Confirm password<input name="confirm_password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></label>}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="primary-button" disabled={pending}>{pending ? "Please wait…" : registering ? "Register" : "Sign in"}</button>
    </form>
    <p>{registering ? "Already registered? " : "New here? "}<Link href={registering ? "/login" : "/register"}>{registering ? "Sign in" : "Create an account"}</Link></p>
  </section></main>;
}
