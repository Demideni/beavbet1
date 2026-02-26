import ArenaClient from "./ArenaClient";
import { TournamentHero } from "@/components/arena/TournamentHero";
import { featuredTournamentZava } from "@/components/arena/FeaturedTournamentData";

export const metadata = {
  title: "BeavBet Arena",
};

export default function ArenaPage() {
  return <ArenaClient />;
}
