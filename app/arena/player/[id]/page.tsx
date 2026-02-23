import ArenaPlayerClient from "./ArenaPlayerClient";

export const metadata = {
  title: "Player • BeavBet Arena",
};

export default function Page({ params }: { params: { id: string } }) {
  return <ArenaPlayerClient userId={params.id} />;
}
