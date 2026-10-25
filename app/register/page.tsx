import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import AuthForm from "../auth-form";

async function Register() {
  if (await currentUser()) redirect("/");
  return <AuthForm mode="register" />;
}
export default function Page() {
  return <Suspense fallback={<p>Loading registration…</p>}><Register /></Suspense>;
}
