import ArenaPlayerClient from "./ArenaPlayerClient";

export const metadata = {
  title: "Player • BeavBet Arena",
};

// Next.js 15+ passes `params` (and `searchParams`) as Promises in Server Components.
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArenaPlayerClient userId={id} />;
}