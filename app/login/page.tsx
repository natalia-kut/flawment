import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-path";
import AuthForm from "../auth-form";

export const metadata: Metadata = { title: "Sign in | Flawment" };

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  // The page that sent the person here, to return to afterwards.
  const next = safeReturnPath((await searchParams).next);
  if (await currentUser()) redirect(next);
  return <AuthForm mode="login" next={next} />;
}
export default function Page({ searchParams }: PageProps<"/login">) {
  return <Suspense fallback={<p>Loading sign in…</p>}><Login searchParams={searchParams} /></Suspense>;
}
