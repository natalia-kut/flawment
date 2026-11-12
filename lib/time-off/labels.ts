import type { AbsenceType } from "@/src/generated/prisma/enums";

export const absenceTypeLabels: Record<AbsenceType, string> = {
  VACATION: "Vacation",
  SICK_LEAVE: "Sick leave",
  BUSINESS_TRIP: "Business trip",
  OTHER: "Other",
};

/** "Vacation", or "Vacation, Business trip" for back-to-back absences. */
export const reasonLabel = (reasons: AbsenceType[]) => reasons.map((type) => absenceTypeLabels[type]).join(", ");
