import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import AuthForm from "../auth-form";

async function Login() {
  if (await currentUser()) redirect("/");
  return <AuthForm mode="login" />;
}
export default function Page() {
  return <Suspense fallback={<p>Loading sign in…</p>}><Login /></Suspense>;
}
