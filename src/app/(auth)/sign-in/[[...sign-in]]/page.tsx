import { AuthForm } from "@/components/auth/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Nyoni Members wardrobe.",
};

export default function SignInPage() {
  return <AuthForm mode="sign-in" />;
}
