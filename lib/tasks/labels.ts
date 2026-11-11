/** How task statuses and priorities are named in the interface (matching the board's columns). */
export const taskStatusLabels: Record<string, string> = {
  TO_DO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "To review",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

export const taskPriorityLabels: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "4 December 2026" for a YYYY-MM-DD deadline, or "No deadline". */
export function formatTaskDeadline(value: string) {
  return value ? longDate.format(new Date(value + "T00:00:00Z")) : "No deadline";
}
