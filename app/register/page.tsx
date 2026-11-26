import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-path";
import AuthForm from "../auth-form";

export const metadata: Metadata = { title: "Create an account | Flawment" };

async function Register({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  // The page that sent the person here, to return to afterwards.
  const next = safeReturnPath((await searchParams).next);
  if (await currentUser()) redirect(next);
  return <AuthForm mode="register" next={next} />;
}
export default function Page({ searchParams }: PageProps<"/register">) {
  return <Suspense fallback={<p>Loading registration…</p>}><Register searchParams={searchParams} /></Suspense>;
}
