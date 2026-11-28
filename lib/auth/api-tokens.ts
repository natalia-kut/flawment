import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cleanLine } from "@/lib/text";
import type { ApiScope } from "@/src/generated/prisma/enums";
import { MAX_TOKEN_NAME, MAX_TOKENS, scopeLabels, TOKEN_LIFETIMES, type ApiTokenSummary } from "./api-token-limits";

export type { ApiTokenSummary } from "./api-token-limits";

/**
 * Personal access tokens: how tools outside the browser (an MCP client, a calendar
 * app) act as a person. Like sessions, only a hash is stored; the token itself is
 * shown once, when it is created. Nothing here reads cookies, so route handlers,
 * scripts and tests use it alike.
 */

export const TOKEN_PREFIX = "flw_";
const tokenPattern = /^flw_[a-f0-9]{64}$/;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

const scopes = Object.keys(scopeLabels) as ApiScope[];

// Writing on every request would turn each MCP call into a database write.
const lastUsedPrecision = 5 * 60_000;

export class ApiTokenError extends Error {}

export async function listApiTokens(userId: number): Promise<ApiTokenSummary[]> {
  const tokens = await prisma.apiToken.findMany({ where: { user_id: userId }, orderBy: { created_at: "desc" } });
  return tokens.map((token) => ({
    id: token.id, name: token.name, prefix: token.prefix, scopes: token.scopes,
    expiresAt: token.expires_at.toISOString(), lastUsedAt: token.last_used_at?.toISOString() ?? null,
    createdAt: token.created_at.toISOString(),
  }));
}

/** Creates a token from the profile form; returns it in full, the only time it is known. */
export async function createApiToken(userId: number, data: FormData, now = new Date()) {
  const name = cleanLine(String(data.get("name") ?? ""));
  if (!name || name.length > MAX_TOKEN_NAME) throw new ApiTokenError(`Give the token a name of up to ${MAX_TOKEN_NAME} characters.`);
  const chosen = [...new Set(data.getAll("scopes").map(String))];
  if (chosen.length === 0) throw new ApiTokenError("Choose what the token may be used for.");
  if (chosen.some((scope) => !scopes.includes(scope as ApiScope))) throw new ApiTokenError("Choose what the token may be used for.");
  // A calendar token travels in a link (calendar apps send no headers), so it may do nothing else.
  if (chosen.includes("CALENDAR") && chosen.length > 1) throw new ApiTokenError("A calendar token is part of a link, so it can only be used for the calendar.");
  const days = Number(data.get("days"));
  if (!TOKEN_LIFETIMES.includes(days as (typeof TOKEN_LIFETIMES)[number])) throw new ApiTokenError("Choose when the token expires.");

  const token = TOKEN_PREFIX + randomBytes(32).toString("hex");
  // Counted and created together, so two tabs cannot both add the tenth token.
  const saved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (await tx.apiToken.count({ where: { user_id: userId } }) >= MAX_TOKENS) {
      throw new ApiTokenError(`You can have up to ${MAX_TOKENS} tokens. Revoke one you no longer use first.`);
    }
    return tx.apiToken.create({ data: {
      user_id: userId, name, token_hash: digest(token), prefix: token.slice(0, TOKEN_PREFIX.length + 6),
      scopes: chosen as ApiScope[], expires_at: new Date(now.getTime() + days * 86_400_000),
    } });
  });
  return { id: saved.id, token, scopes: saved.scopes };
}

/** Revokes one of your own tokens; someone else's id changes nothing. */
export async function deleteApiToken(userId: number, id: number) {
  const { count } = await prisma.apiToken.deleteMany({ where: { id, user_id: userId } });
  return count > 0;
}

/** Revokes all of a person's tokens: after a password change, whoever knew the old one may have made some. */
export async function deleteAllApiTokens(userId: number) {
  const { count } = await prisma.apiToken.deleteMany({ where: { user_id: userId } });
  return count;
}

/** The token from an `Authorization: Bearer …` header, or null. */
export function bearerToken(request: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

/**
 * The person a token acts for, or null when it is malformed, unknown, expired,
 * lacks `scope`, or belongs to a deactivated account. The same shape as
 * currentUser(), so it works as an Actor.
 */
export async function userFromToken(token: string | null, scope: ApiScope, now = new Date()) {
  if (!token || !tokenPattern.test(token)) return null;
  const saved = await prisma.apiToken.findUnique({
    where: { token_hash: digest(token) },
    include: { user: { select: { id: true, username: true, first_name: true, last_name: true, role: true, photo_updated_at: true, is_active: true } } },
  });
  if (!saved || saved.expires_at <= now || !saved.scopes.includes(scope) || !saved.user.is_active) return null;

  if (!saved.last_used_at || now.getTime() - saved.last_used_at.getTime() > lastUsedPrecision) {
    // updateMany: a token revoked a moment ago is not an error here.
    await prisma.apiToken.updateMany({ where: { id: saved.id }, data: { last_used_at: now } });
  }
  const { id, username, first_name, last_name, role, photo_updated_at } = saved.user;
  return { id, username, first_name, last_name, role, photoVersion: photo_updated_at?.toISOString() ?? null };
}
