import Cs2DuelRoomClient from "./Cs2DuelRoomClient";

export const metadata = {
  title: "CS2 Duel • BeavBet Arena",
};

// Next.js 15: `params` is a Promise in the App Router PageProps typing.
export default async function Cs2DuelRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Cs2DuelRoomClient duelId={id} />;
}
