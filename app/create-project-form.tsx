"use client";

import { useActionState } from "react";

export type CreateProjectState = {
  success: boolean;
  message: string;
};

type ProjectOwner = {
  id: number;
  name: string;
};

type CreateProjectFormProps = {
  owners: ProjectOwner[];
  createAction: (
    previousState: CreateProjectState,
    formData: FormData,
  ) => Promise<CreateProjectState>;
};

const initialState: CreateProjectState = {
  success: false,
  message: "",
};

export default function CreateProjectForm({
  owners,
  createAction,
}: CreateProjectFormProps) {
  const [state, formAction, pending] = useActionState(
    createAction,
    initialState,
  );

  return (
    <details className="create-project">
      <summary>+ New project</summary>

      <form action={formAction} className="create-project-form">
        <h2>Create project</h2>

        <fieldset disabled={pending || owners.length === 0}>
          <legend>Project details</legend>

          <label htmlFor="project-name">Project name *</label>
          <input
            id="project-name"
            name="name"
            type="text"
            required
            maxLength={150}
            placeholder="Enter project name"
          />

          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            name="description"
            rows={4}
            maxLength={5000}
            placeholder="What is this project about?"
          />

          <label htmlFor="project-start">Start date *</label>
          <input
            id="project-start"
            name="start_date"
            type="date"
            required
          />

          <label htmlFor="project-end">Deadline</label>
          <input
            id="project-end"
            name="end_date"
            type="date"
          />

          <label htmlFor="project-owner">Project owner *</label>
          <select
            id="project-owner"
            name="owner_id"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Select project owner
            </option>

            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>

          <button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Create project"}
          </button>
        </fieldset>

        {owners.length === 0 && (
          <p>No active users are available to own a project.</p>
        )}

        <p
          aria-live="polite"
          className={state.success ? "form-success" : "form-error"}
        >
          {state.message}
        </p>
      </form>
    </details>
  );
}