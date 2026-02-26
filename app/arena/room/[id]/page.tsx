import RoomClient from "../roomClient";

export const metadata = {
  title: "Room — BeavBet Arena",
};

export default async function RoomByIdPage(
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  return <RoomClient userId={params.id} />;
}