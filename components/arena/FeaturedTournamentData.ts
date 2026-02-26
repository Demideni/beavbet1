import type { FeaturedTournament } from "./TournamentHero";

export const featuredTournamentZava: FeaturedTournament = {
  id: "zava-cs2",
  game: "CS2",
  title: 'Турнир стримера "Зава" — 1v1',
  prizeText: "Призовой фонд: 15 000 ₽",
  // 3 марта 20:00 по Москве:
  startsAtISO: "2026-03-03T20:00:00+03:00",
  bannerUrl: "/arena/tournaments/zava-banner.png",
  maxPlayers: 32,
  playersRegistered: 0,
  ctaHref: "/arena/tournaments", // пока ведём на список, потом сделаем /arena/tournaments/zava-cs2
};