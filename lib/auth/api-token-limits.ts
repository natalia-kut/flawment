import type { ApiScope } from "@/src/generated/prisma/enums";

// Shared by the token service and the profile form, so the form needs no server code.

export const MAX_TOKENS = 10;
export const MAX_TOKEN_NAME = 60;
export const TOKEN_LIFETIMES = [30, 90, 365] as const;
export const scopeLabels: Record<ApiScope, string> = {
  MCP_READ: "AI assistants (MCP): read projects, tasks and the team",
  CALENDAR: "Calendar feed: deadlines and time off",
};

export type ApiTokenSummary = {
  id: number; name: string; prefix: string; scopes: ApiScope[];
  expiresAt: string; lastUsedAt: string | null; createdAt: string;
};
