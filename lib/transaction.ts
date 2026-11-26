import { prisma } from "@/lib/prisma";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const ATTEMPTS = 3;

/** Postgres refused to commit because a concurrent transaction touched the same rows (P2034). */
function isSerializationConflict(error: unknown) {
  return !!error && typeof error === "object" && "code" in error && error.code === "P2034";
}

/**
 * A Serializable transaction that is run again when it loses a race with a
 * concurrent one. Two people saving different fields of the same task at the
 * same moment is not an error: Postgres refuses one commit, and running it
 * again sees the other's change. Errors thrown by `fn` itself are not retried.
 */
export async function serializable<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt >= ATTEMPTS || !isSerializationConflict(error)) throw error;
      // A short, growing pause with jitter, so the two do not collide again.
      await new Promise((resolve) => setTimeout(resolve, attempt * 20 + Math.random() * 30));
    }
  }
}
