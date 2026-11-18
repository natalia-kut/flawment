import { z } from "zod";
import { isValidDay } from "@/lib/time-off/dates";

export const day = z.iso.date().refine(isValidDay);
export const recordId = z.number().int().min(1).max(2147483647);

export const projectPlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional(),
  start_date: day,
  end_date: day.optional(),
  tasks: z.array(z.object({
    title: z.string().trim().min(1).max(150),
    description: z.string().trim().max(5000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    deadline: day.optional(),
    assignee_id: recordId.optional(),
    work_from: day.optional().describe("First planned work day. Required for an assignee."),
    work_to: day.optional().describe("Last planned work day. Required for an assignee."),
  })).max(30).describe("Initial tasks for the project. Use an empty list for a project without tasks."),
});

export type ProjectPlan = z.infer<typeof projectPlanSchema>;
export type ProjectPlanProposal = {
  plan: ProjectPlan;
  people: { id: number; name: string }[];
};
