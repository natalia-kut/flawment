"use client";

import { useActionState, useState } from "react";
import { profileAction } from "@/lib/profiles/actions";
import UserAvatar from "./user-avatar";

export default function ProfileView({ user }: { user: {
  id: number; first_name: string; last_name: string; email: string; username: string;
  description: string | null; photoVersion: string | null;
} }) {
  const [state, action, pending] = useActionState(profileAction, {});
  const [photoError, setPhotoError] = useState("");
  return <section className="profile-page">
    <header className="page-header"><p className="eyebrow">YOUR ACCOUNT</p><h1>My profile</h1><p>Your description and photo are shared across your projects.</p></header>
    <div className="workspace-card profile-editor">
      <div className="profile-heading"><UserAvatar id={user.id} firstName={user.first_name} lastName={user.last_name} photoVersion={user.photoVersion} size={88} /><div><h2>{user.first_name} {user.last_name}</h2><p>@{user.username} · {user.email}</p></div></div>
      <form action={action} className="workspace-form">
        <fieldset disabled={pending}>
          <label>About me<textarea name="description" maxLength={2000} defaultValue={user.description ?? ""} placeholder="Share a little about yourself, your skills and interests." rows={5} /></label>
          <label>Profile photo<input key={user.photoVersion ?? "none"} name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help" onChange={(event) => setPhotoError((event.target.files?.[0]?.size ?? 0) > 2 * 1024 * 1024 ? "Choose a photo no larger than 2 MB." : "")} /></label>
          {photoError && <p role="alert" className="form-error">{photoError}</p>}
          <p id="photo-help" className="field-help">JPEG, PNG or WebP, up to 2 MB and 16 megapixels. Photos are cropped to a square. Leave empty to keep your current photo.</p>
          {user.photoVersion && <label className="checkbox-label"><input type="checkbox" name="remove_photo" /> Remove current photo</label>}
          <button className="primary-button" type="submit" disabled={!!photoError}>{pending ? "Saving…" : "Save profile"}</button>
        </fieldset>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.success && <p className="form-success" role="status">{state.success}</p>}
      </form>
    </div>
  </section>;
}
