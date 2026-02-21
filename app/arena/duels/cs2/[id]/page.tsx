import Cs2DuelRoomClient from "./Cs2DuelRoomClient";

export const metadata = {
  title: "CS2 Duel • BeavBet Arena",
};

export default function Cs2DuelRoomPage({ params }: { params: { id: string } }) {
  return <Cs2DuelRoomClient duelId={params.id} />;
}
