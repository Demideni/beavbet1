import { redirect } from "next/navigation";

export default function ArenaProfilePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  if (searchParams?.tab === "friends") {
    redirect("/arena/friends");
  }

  // если у тебя в профиле уже есть client-компонент, оставь его тут как было.
  // Например:
  // return <ArenaProfileClient />;
  redirect("/arena/profile?tab=messages");
}