"use client";

import { startTransition, useActionState, useState } from "react";
import { changePasswordAction, endOtherSessionsAction, type PasswordState } from "@/lib/auth/actions";
import { OFFLINE, reach } from "@/components/ui/offline";
import { submitInPlace } from "@/components/ui/submit-in-place";

/**
 * Your password on My profile: change it (which signs you out on your other devices),
 * or only sign out elsewhere, for a lost phone or a shared computer.
 */
export default function PasswordCard() {
  const [changing, setChanging] = useState(false);
  const [state, action, pending] = useActionState(async (previous: PasswordState, data: FormData) => {
    const result = await reach(() => changePasswordAction(previous, data), { error: OFFLINE });
    if (result.message) setChanging(false);
    return result;
  }, {});
  const [others, endOthers, ending] = useActionState(
    () => reach(() => endOtherSessionsAction(), { error: OFFLINE }), {} as PasswordState);
  // The newest of the two answers is the one shown.
  const [latest, setLatest] = useState<"change" | "others">("change");
  const shown = latest === "change" ? state : others;

  return <section className="workspace-card profile-mini-card password-card" aria-labelledby="password-title">
    <div className="profile-card-head">
      <h2 id="password-title">Password</h2>
      {!changing && <button type="button" className="inline-link text-button" onClick={() => { setChanging(true); setLatest("change"); }}>Change password</button>}
    </div>
    {changing ? <form action={action} onSubmit={submitInPlace(action)} className="password-form">
      <fieldset disabled={pending}>
        <label>Current password<input name="current_password" type="password" autoComplete="current-password" required maxLength={128} autoFocus /></label>
        <label>New password<input name="new_password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></label>
        <label>Repeat new password<input name="confirm_password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></label>
        <p className="muted-value">10 to 128 characters. Your other devices are signed out when it changes.</p>
        <div className="password-actions">
          <button type="button" className="secondary-button" onClick={() => setChanging(false)}>Cancel</button>
          <button className="primary-button">{pending ? "Saving…" : "Change password"}</button>
        </div>
      </fieldset>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </form> : <>
      <p>Signed in somewhere you no longer use?{" "}
        <button type="button" className="inline-link text-button" disabled={ending}
          onClick={() => { setLatest("others"); startTransition(() => endOthers()); }}>{ending ? "Signing out…" : "Sign out other devices"}</button></p>
      {shown.message && <p className="password-done" role="status">{shown.message}</p>}
      {latest === "others" && others.error && <p className="form-error" role="alert">{others.error}</p>}
    </>}
  </section>;
}
