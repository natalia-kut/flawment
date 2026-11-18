import { z } from "zod";
import { workspaceToday } from "@/lib/time-off/dates";
import { defineTool } from "./define";

export const getCurrentDate = defineTool({
  name: "get_current_date",
  description: "Returns today's date as YYYY-MM-DD.",
  status: "Checking the calendar…",
  input: z.object({}),
  async run() {
    return { ok: true, value: workspaceToday() };
  },
});
