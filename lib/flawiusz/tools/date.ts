import { z } from "zod";
import { localDay } from "@/lib/documents/engine";
import { defineTool } from "./define";

export const getCurrentDate = defineTool({
  name: "get_current_date",
  description: "Returns today's date as YYYY-MM-DD.",
  status: "Checking the calendar…",
  input: z.object({}),
  async run() {
    return { ok: true, value: localDay() };
  },
});
