import RoomClient from "../roomClient";

export const metadata = {
  title: "Room — BeavBet Arena",
};

export default function RoomByIdPage({ params }: { params: { id: string } }) {
  return <RoomClient userId={params.id} />;
}