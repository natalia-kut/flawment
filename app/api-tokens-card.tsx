"use client";

import { startTransition, useActionState, useState } from "react";
import { createApiTokenAction, deleteApiTokenAction, type ApiTokenState } from "@/lib/auth/actions";
import { calendarFeedUrl, MAX_TOKEN_NAME, scopeLabels, TOKEN_LIFETIMES, type ApiTokenSummary } from "@/lib/auth/api-token-limits";
import { useConfirm } from "@/components/ui/confirm";
import { OFFLINE, reach } from "@/components/ui/offline";
import { submitInPlace } from "@/components/ui/submit-in-place";
import { formatShortDay, workspaceToday } from "@/lib/time-off/dates";
import type { ApiScope } from "@/src/generated/prisma/enums";

const day = (iso: string) => formatShortDay(workspaceToday(new Date(iso)));

/**
 * Access tokens on My profile: for an AI assistant (MCP) or a calendar app to act
 * as you. A new token is shown once, right after it is made.
 */
export default function ApiTokensCard({ tokens }: { tokens: ApiTokenSummary[] }) {
  const [creating, setCreating] = useState(false);
  const [state, action, pending] = useActionState(async (previous: ApiTokenState, data: FormData) => {
    const result = await reach(() => createApiTokenAction(previous, data), { error: OFFLINE });
    if (result.token) setCreating(false);
    return result;
  }, {});
  const [revokeError, setRevokeError] = useState("");
  const [copied, setCopied] = useState(false);
  const ask = useConfirm();

  async function revoke(token: ApiTokenSummary) {
    if (!await ask({ title: `Revoke “${token.name}”?`, message: "Anything using this token stops working at once.", confirm: "Revoke" })) return;
    setRevokeError("");
    startTransition(async () => {
      const result = await reach(() => deleteApiTokenAction(token.id), { error: OFFLINE });
      if (result.error) setRevokeError(result.error);
    });
  }

  // Only after a token was made in this browser, so window is there.
  const shown = state.token && (state.calendar ? calendarFeedUrl(window.location.origin, state.token) : state.token);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <section className="workspace-card profile-mini-card api-tokens-card" aria-labelledby="api-tokens-title">
    <div className="profile-card-head">
      <h2 id="api-tokens-title">Access tokens</h2>
      {!creating && <button type="button" className="inline-link text-button" onClick={() => { setCreating(true); setCopied(false); }}>New token</button>}
    </div>

    {shown && !creating && <div className="api-token-new" role="status">
      <p>{state.calendar
        ? "Copy your calendar link now: it will not be shown again. In your calendar app, add a calendar from a URL and paste it."
        : "Copy your new token now: it will not be shown again."}</p>
      <div className="api-token-value">
        <code>{shown}</code>
        <button type="button" className="secondary-button" onClick={() => copy(shown)}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>}

    {creating ? <form action={action} onSubmit={submitInPlace(action)} className="workspace-form api-token-form">
      <fieldset disabled={pending}>
        <label>Name<input name="name" required maxLength={MAX_TOKEN_NAME} placeholder="Claude on my laptop" autoFocus /></label>
        <fieldset className="api-token-scopes">
          <legend>Used for</legend>
          {/* One use each: a calendar token travels in a link, so it may do nothing else. */}
          {(Object.entries(scopeLabels) as [ApiScope, string][]).map(([scope, label]) =>
            <label key={scope} className="checkbox-label"><input type="radio" name="scopes" value={scope} required defaultChecked={scope === "MCP_READ"} />{label}</label>)}
        </fieldset>
        <label>Expires after
          <select name="days" defaultValue="90">
            {TOKEN_LIFETIMES.map((days) => <option key={days} value={days}>{days} days</option>)}
          </select>
        </label>
        <p className="muted-value">The token can see everything you can see. Changing your password revokes all your tokens.</p>
        <div className="password-actions">
          <button type="button" className="secondary-button" onClick={() => setCreating(false)}>Cancel</button>
          <button className="primary-button">{pending ? "Creating…" : "Create token"}</button>
        </div>
      </fieldset>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </form> : tokens.length === 0
      ? <p>Let an AI assistant or a calendar app use Flawment as you.</p>
      : <ul className="api-token-list">
        {tokens.map((token) => <li key={token.id}>
          <div>
            <strong>{token.name}</strong> <code>{token.prefix}…</code>
            <small>
              {token.scopes.map((scope) => scope === "MCP_READ" ? "MCP" : "Calendar").join(", ")}
              {" · "}{new Date(token.expiresAt) <= new Date() ? "Expired" : `Expires ${day(token.expiresAt)}`}
              {" · "}{token.lastUsedAt ? `Last used ${day(token.lastUsedAt)}` : "Never used"}
            </small>
          </div>
          <button type="button" className="inline-link text-button danger-text" onClick={() => revoke(token)}>Revoke</button>
        </li>)}
      </ul>}
    {revokeError && <p className="form-error" role="alert">{revokeError}</p>}
  </section>;
}
