import ArenaPlayerClient from "./ArenaPlayerClient";

export const metadata = {
  title: "Player • BeavBet Arena",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await Promise.resolve(params);
  return <ArenaPlayerClient userId={id} />;
}