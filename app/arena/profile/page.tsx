import { redirect } from "next/navigation";
import ArenaProfileClient from "./ArenaProfileClient";

type SearchParams = Promise<{ tab?: string }>;

export default async function ArenaProfilePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = (await searchParams) ?? {};

  // старый таб друзей -> новая страница друзей
  if (sp.tab === "friends") {
    redirect("/arena/friends");
    if (sp.tab === "messages") {
  redirect("/arena/messages");
}
  }

  // остальной профиль как был
  return <ArenaProfileClient />;
}