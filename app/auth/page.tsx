import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AuthClient from "./ui";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(sp: Record<string, string | string[] | undefined> | undefined, key: string): string | null {
  const v = sp?.[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? null;
  return null;
}

export default async function AuthPage(props: Props) {
  const sp = props.searchParams ? await Promise.resolve(props.searchParams) : undefined;

  const rawNext = getParam(sp, "next") || "/account";
  const next = rawNext.startsWith("/") ? rawNext : "/account";

  const session = await getSessionUser();
  if (session) {
    // Server-side redirect is the most reliable (no client navigation/cookie timing issues).
    redirect(next);
  }

  return <AuthClient />;
}
