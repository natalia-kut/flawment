"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/session";
import { createPlannedProject, ProjectPlanError } from "./project-plan";

export async function applyProjectPlan(plan: unknown) {
  const actor = await currentUser();
  if (!actor) return { ok: false as const, error: "Sign in to create the project." };
  try {
    const project = await createPlannedProject(actor, plan);
    revalidatePath("/");
    return { ok: true as const, project };
  } catch (error) {
    if (error instanceof ProjectPlanError) return { ok: false as const, error: error.message };
    console.error("Could not create planned project", error);
    return { ok: false as const, error: "The project could not be created. Please try again." };
  }
}
